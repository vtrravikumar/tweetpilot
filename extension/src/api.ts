import type { BackgroundMessage, BackgroundResponse, GenerateRequest } from "./types";

export async function generateTweet(request: GenerateRequest): Promise<import("./types").GenerateResponse> {
  const message: BackgroundMessage = { type: "generate", request };
  const response = (await chrome.runtime.sendMessage(message)) as BackgroundResponse;
  if (!response || !response.ok) {
    throw new Error(response && ("error" in response) ? response["error"] : "Tweet generation failed.");
  }
  if (typeof response.tweet !== "string") {
    throw new Error("Backend returned an invalid tweet response.");
  }
  return {
    tweet: response.tweet,
    ...(response.mode ? { mode: response.mode } : {}),
    ...(response.fallbackReason ? { fallbackReason: response.fallbackReason } : {}),
    ...(response.sources ? { sources: response.sources } : {}),
    ...(response.remaining !== undefined ? { remaining: response.remaining } : {}),
    ...(response.owner !== undefined ? { owner: response.owner } : {}),
    ...(response.unlimited !== undefined ? { unlimited: response.unlimited } : {})
  };
}
