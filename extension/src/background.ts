import {
  API_ACTIVATE_LICENSE_URL, API_FREE_LICENSE_URL, API_GENERATE_URL,
  API_PAYMENT_LINK_URL, API_PAYMENT_VERIFY_URL, STORAGE_KEYS
} from "./constants";
import { getApiKey, getSavedLicenseStatus, saveLicense, type LicenseStatus } from "./settings";
import type { BackgroundMessage, BackgroundResponse, GenerateResponse } from "./types";

async function parseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return payload?.error?.message || `Backend returned HTTP ${response.status}.`;
}

async function activate(licenseKey: string): Promise<LicenseStatus> {
  const key = licenseKey.trim();
  if (!/^vichar_[A-Za-z0-9_-]{43}$/.test(key)) throw new Error("Enter a valid Vichar license key.");
  const response = await fetch(API_ACTIVATE_LICENSE_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ licenseKey: key }) });
  if (!response.ok) throw new Error(await parseError(response));
  const status = await response.json() as LicenseStatus;
  if (status.active !== true) throw new Error("This Vichar license could not be activated.");
  await saveLicense(key, status);
  return status;
}

async function buyCredits(packId: "starter" | "plus" | "pro"): Promise<{ checkoutUrl: string }> {
  const values = await chrome.storage.local.get([STORAGE_KEYS.licenseKey, STORAGE_KEYS.licenseOwner]);
  const licenseKey = values[STORAGE_KEYS.licenseKey];
  if (typeof licenseKey !== "string" || !/^vichar_[A-Za-z0-9_-]{43}$/.test(licenseKey)) throw new Error("Activate a Vichar license before buying credits.");
  if (values[STORAGE_KEYS.licenseOwner] === true) throw new Error("Owner access is unlimited; no credits are needed.");
  const response = await fetch(API_PAYMENT_LINK_URL, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ licenseKey, packId })
  });
  if (!response.ok) throw new Error(await parseError(response));
  const result = await response.json() as { paymentLinkId?: string; checkoutUrl?: string };
  if (typeof result.paymentLinkId !== "string" || typeof result.checkoutUrl !== "string" || !result.checkoutUrl.startsWith("https://")) {
    throw new Error("The payment service returned an invalid checkout link.");
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.pendingPaymentLinkId]: result.paymentLinkId });
  await chrome.tabs.create({ url: result.checkoutUrl });
  return { checkoutUrl: result.checkoutUrl };
}

async function checkPayment(): Promise<{ paid: boolean; credited: boolean; balance: number | null }> {
  const values = await chrome.storage.local.get([STORAGE_KEYS.licenseKey, STORAGE_KEYS.pendingPaymentLinkId]);
  const licenseKey = values[STORAGE_KEYS.licenseKey];
  const paymentLinkId = values[STORAGE_KEYS.pendingPaymentLinkId];
  if (typeof licenseKey !== "string" || typeof paymentLinkId !== "string") throw new Error("No pending payment was found for this license.");
  const response = await fetch(API_PAYMENT_VERIFY_URL, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ licenseKey, paymentLinkId })
  });
  if (!response.ok) throw new Error(await parseError(response));
  const result = await response.json() as { paid?: boolean; credited?: boolean; balance?: number | null };
  if (result.paid && typeof result.balance === "number") {
    await chrome.storage.local.set({ [STORAGE_KEYS.licenseBalance]: result.balance });
    await chrome.storage.local.remove(STORAGE_KEYS.pendingPaymentLinkId);
  }
  return { paid: result.paid === true, credited: result.credited === true, balance: typeof result.balance === "number" ? result.balance : null };
}

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse: (response: BackgroundResponse) => void) => {
  if (message?.type === "health") { sendResponse({ ok: true, tweet: "ok" }); return; }
  if (message?.type === "license-status") {
    void getSavedLicenseStatus().then((status) => {
      if (status) sendResponse({ ok: true, owner: status.owner, unlimited: status.unlimited, remaining: status.balance });
      else sendResponse({ ok: true, owner: false, unlimited: false, remaining: null });
    }).catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to read license." }));
    return true;
  }
  if (message?.type === "free-trial") {
    void fetch(API_FREE_LICENSE_URL, { method: "POST" }).then(async (response) => {
      if (!response.ok) throw new Error(await parseError(response));
      const data = await response.json() as { licenseKey: string; balance: number; freeCredits: number };
      if (typeof data.licenseKey !== "string" || typeof data.balance !== "number") throw new Error("Backend returned an invalid free license.");
      await saveLicense(data.licenseKey, { active: true, owner: false, unlimited: false, balance: data.balance });
      sendResponse({ ok: true, licenseKey: data.licenseKey, remaining: data.balance, freeCredits: data.freeCredits });
    }).catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to start the free trial." }));
    return true;
  }
  if (message?.type === "activate-license") {
    void activate(message.licenseKey).then((status) => sendResponse({ ok: true, remaining: status.balance, owner: status.owner, unlimited: status.unlimited }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to activate license." }));
    return true;
  }
  if (message?.type === "buy-credits") {
    void buyCredits(message.packId).then(() => sendResponse({ ok: true, checkoutUrl: "opened" }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to start payment." }));
    return true;
  }
  if (message?.type === "check-payment") {
    void checkPayment().then((result) => sendResponse({ ok: true, remaining: result.balance, paid: result.paid, credited: result.credited }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to verify payment." }));
    return true;
  }
  if (message?.type !== "generate") { sendResponse({ ok: false, error: "Unsupported Vichar message." }); return; }

  void getApiKey().then(async (apiKey) => {
    const response = await fetch(API_GENERATE_URL, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(message.request)
    });
    if (!response.ok) throw new Error(await parseError(response));
    const payload = await response.json().catch(() => null) as GenerateResponse | null;
    if (!payload || typeof payload.tweet !== "string") throw new Error("Backend returned an invalid tweet response.");
    const remainingHeader = response.headers.get("x-vichar-remaining");
    const owner = response.headers.get("x-vichar-access") === "owner" || remainingHeader === "unlimited";
    const remaining = owner ? null : remainingHeader !== null && /^\d+$/.test(remainingHeader) ? Number(remainingHeader) : null;
    if (!owner && remaining !== null) await chrome.storage.local.set({ [STORAGE_KEYS.licenseBalance]: remaining });
    sendResponse({ ok: true, tweet: payload.tweet, ...(payload.mode ? { mode: payload.mode } : {}), ...(payload.fallbackReason ? { fallbackReason: payload.fallbackReason } : {}), ...(payload.sources ? { sources: payload.sources } : {}), remaining, owner, unlimited: owner });
  }).catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to reach Vichar backend." }));
  return true;
});
