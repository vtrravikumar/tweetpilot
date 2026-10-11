import { STORAGE_KEYS } from "./constants";

export interface LicenseStatus {
  active: boolean;
  owner: boolean;
  unlimited: boolean;
  balance: number | null;
}

export async function getApiKey(): Promise<string> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.licenseKey)) as Record<string, unknown>;
  const key = result[STORAGE_KEYS.licenseKey];
  if (typeof key === "string" && /^vichar_[A-Za-z0-9_-]{43}$/.test(key)) return key;
  throw new Error("Start with 5 free generations or activate your Vichar license below.");
}

export async function saveLicense(licenseKey: string, status: LicenseStatus): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.licenseKey]: licenseKey,
    [STORAGE_KEYS.licenseBalance]: status.balance,
    [STORAGE_KEYS.licenseOwner]: status.owner,
    [STORAGE_KEYS.licenseUnlimited]: status.unlimited
  });
}

export async function getSavedLicenseStatus(): Promise<LicenseStatus | null> {
  const values = (await chrome.storage.local.get([
    STORAGE_KEYS.licenseKey,
    STORAGE_KEYS.licenseBalance,
    STORAGE_KEYS.licenseOwner,
    STORAGE_KEYS.licenseUnlimited
  ])) as Record<string, unknown>;
  const key = values[STORAGE_KEYS.licenseKey];
  if (typeof key !== "string" || !/^vichar_[A-Za-z0-9_-]{43}$/.test(key)) return null;
  return {
    active: true,
    owner: values[STORAGE_KEYS.licenseOwner] === true,
    unlimited: values[STORAGE_KEYS.licenseUnlimited] === true,
    balance: typeof values[STORAGE_KEYS.licenseBalance] === "number" ? values[STORAGE_KEYS.licenseBalance] as number : null
  };
}
