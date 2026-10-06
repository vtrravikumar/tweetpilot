import { STORAGE_KEYS } from "./constants";
import type { StoredSettings } from "./types";

const DEFAULT_SETTINGS: StoredSettings = {
  location: ""
};

export async function loadSettings(): Promise<StoredSettings> {
  const result = (await chrome.storage.local.get([
    STORAGE_KEYS.location,
    "tweetpilot.location"
  ])) as Record<string, unknown>;

  const location =
    typeof result[STORAGE_KEYS.location] === "string"
      ? (result[STORAGE_KEYS.location] as string).trim()
      : typeof result["tweetpilot.location"] === "string"
        ? (result["tweetpilot.location"] as string).trim()
        : DEFAULT_SETTINGS.location;

  return { location };
}

export async function saveLocation(location: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.location]: location.trim().slice(0, 80)
  });
}

/**
 * Vichar usage key.
 *
 * This is deliberately generated per installation rather than hard-coded into
 * the bundle. It is an opaque client identifier used by the backend for usage
 * accounting; it is not an OpenAI credential or a secret.
 */
export async function getApiKey(): Promise<string> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.apiKey)) as Record<
    string,
    unknown
  >;

  const storedApiKey = result[STORAGE_KEYS.apiKey];
  if (typeof storedApiKey === "string") {
    const existing = storedApiKey.trim();
    if (existing.length >= 20) return existing;
  }

  const apiKey = crypto.randomUUID();
  await chrome.storage.local.set({ [STORAGE_KEYS.apiKey]: apiKey });
  return apiKey;
}
