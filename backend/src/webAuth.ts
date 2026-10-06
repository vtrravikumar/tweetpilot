const WEB_ORIGIN = "https://vtrrk.in";
const TOKEN_TTL_SECONDS = 10 * 60;

interface WebTokenPayload {
  aud: "vichar-web";
  iat: number;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function verify(value: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const expected = Uint8Array.from(
    atob(signature.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((signature.length + 3) % 4)),
    (char) => char.charCodeAt(0),
  );
  return crypto.subtle.verify("HMAC", key, expected, new TextEncoder().encode(value));
}

export function isVicharWebOrigin(request: Request): boolean {
  return request.headers.get("origin") === WEB_ORIGIN;
}

export async function issueVicharWebToken(secret: string, nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const payload: WebTokenPayload = {
    aud: "vichar-web",
    iat,
    exp: iat + TOKEN_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return encoded + "." + await sign(encoded, secret);
}

export async function isValidVicharWebToken(
  request: Request,
  secret: string,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!secret || !isVicharWebOrigin(request)) return false;

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization);
  if (!match) return false;

  const [encoded, signature] = match[1].split(".");
  if (!(await verify(encoded, signature, secret))) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as Partial<WebTokenPayload>;
    return (
      payload.aud === "vichar-web" &&
      Number.isSafeInteger(payload.iat) &&
      Number.isSafeInteger(payload.exp) &&
      payload.exp! > Math.floor(nowMs / 1000) &&
      payload.exp! > payload.iat!
    );
  } catch {
    return false;
  }
}

export const VICHAR_WEB_ORIGIN = WEB_ORIGIN;
