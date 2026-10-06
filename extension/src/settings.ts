import { STORAGE_KEYS } from "./constants";
import type { StoredSettings } from "./types";

const DEFAULT_SETTINGS: StoredSettings = {
  location: ""
};

export async function loadSettings(): Promise<StoredSettings> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.location
  )) as Record<string, unknown>;

  const location =
    typeof result[STORAGE_KEYS.location] === "string"
      ? (result[STORAGE_KEYS.location] as string).trim()
      : DEFAULT_SETTINGS.location;

  return { location };
}

export async function saveLocation(location: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.location]: location.trim().slice(0, 80)
  });
}
