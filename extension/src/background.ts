import { API_GENERATE_URL } from "./constants";
import type {
  BackgroundMessage,
  BackgroundResponse,
  GenerateResponse
} from "./types";

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender,
    sendResponse: (response: BackgroundResponse) => void
  ) => {
    if (message?.type === "health") {
      sendResponse({ ok: true, tweet: "ok" });
      return;
    }

    if (message?.type !== "generate") {
      sendResponse({ ok: false, error: "Unsupported Vichar message." });
      return;
    }

    void fetch(API_GENERATE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(message.request)
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | GenerateResponse
          | { error?: string }
          | null;

        if (!response.ok) {
          const detail =
            payload && "error" in payload && payload.error
              ? payload.error
              : `Backend returned HTTP ${response.status}.`;
          sendResponse({ ok: false, error: detail });
          return;
        }

        if (
          !payload ||
          !("tweet" in payload) ||
          typeof payload.tweet !== "string"
        ) {
          sendResponse({
            ok: false,
            error: "Backend returned an invalid tweet response."
          });
          return;
        }

        sendResponse({ ok: true, tweet: payload.tweet });
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to reach Vichar backend."
        });
      });

    return true;
  }
);
