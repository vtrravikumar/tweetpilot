/**
 * License-key primitives. Callers must persist/use only the SHA-256 digest for
 * Durable Object naming and never log or persist the plaintext key.
 */
const KEY_PREFIX = "vichar_";
const KEY_BYTES = 32;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Generate a high-entropy opaque key. Return it to the user only once. */
export function generateLicenseKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  return KEY_PREFIX + base64UrlEncode(bytes);
}

/** Hash a presented license key before using it as a storage/object identifier. */
export async function hashLicenseKey(key: string): Promise<string | null> {
  const normalized = key.trim();
  if (!new RegExp("^" + KEY_PREFIX + "[A-Za-z0-9_-]{43}$").test(normalized)) {
    return null;
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
