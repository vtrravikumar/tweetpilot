import type {
  BackgroundMessage,
  BackgroundResponse,
  GenerateRequest
} from "./types";

export async function generateTweet(
  request: GenerateRequest
): Promise<import("./types").GenerateResponse> {
  const message: BackgroundMessage = { type: "generate", request };
  const response = (await chrome.runtime.sendMessage(
    message
  )) as BackgroundResponse;

  if (!response?.ok || typeof response.tweet !== "string") {
    throw new Error(response?.error || "Tweet generation failed.");
  }

  return {
    tweet: response.tweet,
    ...(response.mode ? { mode: response.mode } : {}),
    ...(response.fallbackReason ? { fallbackReason: response.fallbackReason } : {}),
    ...(response.sources ? { sources: response.sources } : {}),\n    ...(response.remaining !== undefined ? { remaining: response.remaining } : {}),\n    ...(response.owner !== undefined ? { owner: response.owner } : {}),\n    ...(response.unlimited !== undefined ? { unlimited: response.unlimited } : {})
  };
}
