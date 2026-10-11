import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { hashLicenseKey } from "../usage/licenseKeys";
import { VicharUsage } from "../usage/durableObject";

const PACKS = {
  starter: { label: "1,000 generations", credits: 1_000, amount: 1_900 },
  plus: { label: "5,000 generations", credits: 5_000, amount: 4_900 },
  pro: { label: "15,000 generations", credits: 15_000, amount: 9_900 },
} as const;

type PackId = keyof typeof PACKS;
type PaymentLink = { id: string; short_url: string; status: string; amount: number; amount_paid?: number; notes?: Record<string, string> };
type EnvBag = Record<string, unknown>;

function config(env: Env): { keyId: string; keySecret: string; webhookSecret: string } | null {
  const bag = env as unknown as EnvBag;
  const keyId = typeof bag.RAZORPAY_KEY_ID === "string" ? bag.RAZORPAY_KEY_ID.trim() : "";
  const keySecret = typeof bag.RAZORPAY_KEY_SECRET === "string" ? bag.RAZORPAY_KEY_SECRET.trim() : "";
  const webhookSecret = typeof bag.RAZORPAY_WEBHOOK_SECRET === "string" ? bag.RAZORPAY_WEBHOOK_SECRET.trim() : "";
  return keyId && keySecret ? { keyId, keySecret, webhookSecret } : null;
}

function namespaceFor(env: Env): DurableObjectNamespace<VicharUsage> | null {
  return (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE ?? null;
}

async function razorpayRequest<T>(cfg: { keyId: string; keySecret: string }, path: string, init?: RequestInit): Promise<T> {
  const authorization = "Basic " + btoa(cfg.keyId + ":" + cfg.keySecret);
  const response = await fetch("https://api.razorpay.com/v1" + path, {
    ...init,
    headers: { authorization, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error("Razorpay API request failed with HTTP " + response.status);
  return await response.json() as T;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8_192) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

type LicenseResult =
  | { ok: false; response: Response }
  | { ok: true; hash: string; stub: DurableObjectStub<VicharUsage>; body: Record<string, unknown> };

async function getLicense(request: Request, env: Env): Promise<LicenseResult> {
  const body = await readBody(request);
  if (!body) return { ok: false, response: errorResponse(400, "invalid_json", "Request body must be valid JSON.") };
  if (typeof body.licenseKey !== "string") return { ok: false, response: errorResponse(400, "invalid_request", "A licenseKey is required.") };
  const hash = await hashLicenseKey(body.licenseKey);
  if (!hash) return { ok: false, response: errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.") };
  const bag = env as unknown as EnvBag;
  const ownerKey = typeof bag.VICHAR_OWNER_LICENSE_KEY === "string" ? bag.VICHAR_OWNER_LICENSE_KEY.trim() : "";
  const ownerHash = ownerKey ? await hashLicenseKey(ownerKey) : null;
  if (ownerHash && hash === ownerHash) return { ok: false, response: errorResponse(403, "owner_not_eligible", "Owner access is unlimited and does not need credit purchases.") };
  const namespace = namespaceFor(env);
  if (!namespace) return { ok: false, response: errorResponse(503, "license_service_unavailable", "License service is temporarily unavailable.") };
  const stub = namespace.get(namespace.idFromName("license:" + hash));
  if (!await stub.getLicense()) return { ok: false, response: errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.") };
  return { ok: true, hash, stub, body };
}

export const createPaymentLinkRoute: Route = {
  method: "POST",
  path: "/v1/payment/link",
  handler: async (request, env) => {
    const cfg = config(env);
    if (!cfg) return errorResponse(503, "payments_not_configured", "Payments are not configured yet.");
    const license = await getLicense(request, env);
    if (!license.ok) return license.response;
    const packId = license.body.packId;
    if (typeof packId !== "string" || !(packId in PACKS)) return errorResponse(400, "invalid_pack", "Choose a valid Vichar credit pack.");
    const pack = PACKS[packId as PackId];
    try {
      const paymentLink = await razorpayRequest<PaymentLink>(cfg, "/payment_links", {
        method: "POST",
        body: JSON.stringify({
          amount: pack.amount,
          currency: "INR",
          accept_partial: false,
          description: "Vichar " + pack.label,
          reference_id: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
          expire_by: Math.floor(Date.now() / 1000) + 30 * 60,
          reminder_enable: false,
          notes: { license_hash: license.hash, pack_id: packId, credits: String(pack.credits) },
        }),
      });
      if (!paymentLink.id || !paymentLink.short_url || paymentLink.amount !== pack.amount) {
        return errorResponse(502, "payment_link_unavailable", "Razorpay did not return a valid payment link.");
      }
      const registered = await license.stub.registerPaymentLink(paymentLink.id, pack.credits, pack.amount);
      if (!registered) return errorResponse(500, "payment_record_failed", "Unable to register the payment. Please try again.");
      return jsonResponse({
        paymentLinkId: paymentLink.id,
        checkoutUrl: paymentLink.short_url,
        packId,
        credits: pack.credits,
        amountPaise: pack.amount,
        currency: "INR",
      }, 201);
    } catch {
      return errorResponse(502, "payment_provider_unavailable", "Razorpay is temporarily unavailable. Please try again.");
    }
  },
};

export const verifyPaymentRoute: Route = {
  method: "POST",
  path: "/v1/payment/verify",
  handler: async (request, env) => {
    const cfg = config(env);
    if (!cfg) return errorResponse(503, "payments_not_configured", "Payments are not configured yet.");
    const license = await getLicense(request, env);
    if ("response" in license) return license.response;
    const paymentLinkId = license.body.paymentLinkId;
    if (typeof paymentLinkId !== "string" || !/^plink_[A-Za-z0-9]+$/.test(paymentLinkId)) return errorResponse(400, "invalid_payment_link", "A valid payment reference is required.");
    const record = await license.stub.getPaymentLink(paymentLinkId);
    if (!record) return errorResponse(404, "payment_not_found", "This payment does not belong to the active license.");
    if (record.status === "paid") return jsonResponse({ paid: true, credited: false, balance: (await license.stub.getLicense())?.balance ?? null });
    try {
      const paymentLink = await razorpayRequest<PaymentLink>(cfg, "/payment_links/" + encodeURIComponent(paymentLinkId));
      if (paymentLink.notes?.license_hash !== license.hash || paymentLink.amount !== record.amount) {
        return errorResponse(403, "payment_mismatch", "Payment details do not match this license.");
      }
      if (paymentLink.status !== "paid" || paymentLink.amount_paid !== record.amount) {
        return jsonResponse({ paid: false, credited: false, balance: (await license.stub.getLicense())?.balance ?? null });
      }
      const result = await license.stub.fulfilPaymentLink(paymentLink.id, paymentLink.amount_paid);
      return jsonResponse({ paid: true, credited: result.fulfilled, balance: result.balance });
    } catch {
      return errorResponse(502, "payment_verification_unavailable", "Unable to verify payment right now. Please try again.");
    }
  },
};

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export const razorpayWebhookRoute: Route = {
  method: "POST",
  path: "/v1/payment/webhook",
  handler: async (request, env) => {
    const cfg = config(env);
    if (!cfg?.webhookSecret) return errorResponse(503, "webhook_not_configured", "Payment webhook is not configured.");
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 65_536) return errorResponse(413, "request_too_large", "Webhook payload is too large.");
    const expected = await hmacHex(cfg.webhookSecret, raw);
    if (!constantTimeEqual(signature, expected)) return errorResponse(401, "invalid_webhook_signature", "Webhook signature is invalid.");
    let event: { event?: string; payload?: { payment_link?: { entity?: PaymentLink } } };
    try { event = JSON.parse(raw) as typeof event; } catch { return errorResponse(400, "invalid_json", "Webhook payload must be valid JSON."); }
    if (event.event !== "payment_link.paid") return jsonResponse({ received: true, ignored: true });
    const link = event.payload?.payment_link?.entity;
    const hash = link?.notes?.license_hash;
    if (!link?.id || !hash || link.status !== "paid" || typeof link.amount_paid !== "number") {
      return errorResponse(400, "invalid_payment_event", "Paid payment event is incomplete.");
    }
    const namespace = namespaceFor(env);
    if (!namespace) return errorResponse(503, "license_service_unavailable", "License service is temporarily unavailable.");
    const stub = namespace.get(namespace.idFromName("license:" + hash));
    const record = await stub.getPaymentLink(link.id);
    if (!record || record.amount !== link.amount || record.amount !== link.amount_paid) {
      return errorResponse(409, "payment_record_mismatch", "The payment does not match a registered Vichar purchase.");
    }
    const result = await stub.fulfilPaymentLink(link.id, link.amount_paid);
    return jsonResponse({ received: true, credited: result.fulfilled });
  },
};
