import type {
  BackgroundMessage,
  BackgroundResponse,
  GenerateRequest
} from "./types";

export async function generateTweet(
  request: GenerateRequest
): Promise<string> {
  const message: BackgroundMessage = { type: "generate", request };
  const response = (await chrome.runtime.sendMessage(
    message
  )) as BackgroundResponse;

  if (!response?.ok) {
    throw new Error(response?.error || "Tweet generation failed.");
  }

  return response.tweet;
}
