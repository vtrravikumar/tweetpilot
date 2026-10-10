import { API_ACTIVATE_LICENSE_URL, API_FREE_LICENSE_URL, API_GENERATE_URL, STORAGE_KEYS } from "./constants";
import { getApiKey, getSavedLicenseStatus, saveLicense, type LicenseStatus } from "./settings";
import type { BackgroundMessage, BackgroundResponse, GenerateResponse } from "./types";

async function parseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return payload?.error?.message || `Backend returned HTTP ${response.status}.`;
}

async function activate(licenseKey: string): Promise<LicenseStatus> {
  const key = licenseKey.trim();
  if (!/^vichar_[A-Za-z0-9_-]{43}$/.test(key)) throw new Error("Enter a valid Vichar license key.");
  const response = await fetch(API_ACTIVATE_LICENSE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ licenseKey: key })
  });
  if (!response.ok) throw new Error(await parseError(response));
  const status = await response.json() as LicenseStatus;
  if (status.active !== true) throw new Error("This Vichar license could not be activated.");
  await saveLicense(key, status);
  return status;
}

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse: (response: BackgroundResponse) => void) => {
  if (message?.type === "health") {
    sendResponse({ ok: true, tweet: "ok" });
    return;
  }

  if (message?.type === "license-status") {
    void getSavedLicenseStatus().then((status) => {
      if (status) sendResponse({ ok: true, owner: status.owner, unlimited: status.unlimited, remaining: status.balance });
      else sendResponse({ ok: true, owner: false, unlimited: false, remaining: null });
    }).catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to read license." }));
    return true;
  }

  if (message?.type === "free-trial") {
    void fetch(API_FREE_LICENSE_URL, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await parseError(response));
        const data = await response.json() as { licenseKey: string; balance: number; freeCredits: number };
        if (typeof data.licenseKey !== "string" || typeof data.balance !== "number") throw new Error("Backend returned an invalid free license.");
        const status: LicenseStatus = { active: true, owner: false, unlimited: false, balance: data.balance };
        await saveLicense(data.licenseKey, status);
        sendResponse({ ok: true, licenseKey: data.licenseKey, remaining: data.balance, freeCredits: data.freeCredits });
      })
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to start the free trial." }));
    return true;
  }

  if (message?.type === "activate-license") {
    void activate(message.licenseKey)
      .then((status) => sendResponse({ ok: true, remaining: status.balance, owner: status.owner, unlimited: status.unlimited }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to activate license." }));
    return true;
  }

  if (message?.type !== "generate") {
    sendResponse({ ok: false, error: "Unsupported Vichar message." });
    return;
  }

  void getApiKey()
    .then(async (apiKey) => {
      const response = await fetch(API_GENERATE_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(message.request)
      });
      if (!response.ok) throw new Error(await parseError(response));
      const payload = await response.json().catch(() => null) as GenerateResponse | null;
      if (!payload || typeof payload.tweet !== "string") throw new Error("Backend returned an invalid tweet response.");
      const remainingHeader = response.headers.get("x-vichar-remaining");
      const owner = response.headers.get("x-vichar-access") === "owner" || remainingHeader === "unlimited";
      const remaining = owner ? null : remainingHeader !== null && /^\d+$/.test(remainingHeader) ? Number(remainingHeader) : null;
      if (!owner && remaining !== null) {
        await chrome.storage.local.set({ [STORAGE_KEYS.licenseBalance]: remaining });
      }
      sendResponse({
        ok: true, tweet: payload.tweet,
        ...(payload.mode ? { mode: payload.mode } : {}),
        ...(payload.fallbackReason ? { fallbackReason: payload.fallbackReason } : {}),
        ...(payload.sources ? { sources: payload.sources } : {}),
        remaining, owner, unlimited: owner
      });
    })
    .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to reach Vichar backend." }));
  return true;
});
