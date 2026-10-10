export const API_BASE_URL = "https://api.vtrrk.in/vichar";
export const API_GENERATE_URL = `${API_BASE_URL}/v1/tweet/generate`;
export const API_FREE_LICENSE_URL = `${API_BASE_URL}/v1/license/free`;
export const API_ACTIVATE_LICENSE_URL = `${API_BASE_URL}/v1/license/activate`;

export const DEFAULT_MAX_LENGTH = 140;

export const STORAGE_KEYS = {
  apiKey: "vichar.apiKey",
  licenseKey: "vichar.licenseKey",
  licenseBalance: "vichar.licenseBalance",
  licenseOwner: "vichar.licenseOwner",
  licenseUnlimited: "vichar.licenseUnlimited"
} as const;

export const PANEL_ID = "vichar-root";
