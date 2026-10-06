# M1 — Chrome Extension

## Goal

Bring TweetPilot into the X composer without turning the X composer into an AI-only workflow.

## Core UX

When the X Post composer becomes visible:

1. TweetPilot opens with **Surprise me** selected.
2. It generates one suggestion using the production Cloudflare Worker.
3. The suggestion remains outside the X composer until the user explicitly chooses **Use this**.
4. **Another** generates a fresh suggestion.
5. **Dismiss** hides TweetPilot so the user can write their own post normally.
6. The user may type into X at any time.
7. The user uses X's native **Post** button.

## Safety boundaries

- No X API.
- No automated Post click.
- No automatic insertion into the composer.
- No silent replacement of user-written text.
- Explicit confirmation is required before replacing a non-empty X draft.
- No geolocation permission.
- No OpenAI credential in the extension.

## Runtime architecture

```text
X page
  │
  │ content.js
  ▼
TweetPilot UI
  │
  │ chrome.runtime.sendMessage
  ▼
MV3 service worker
  │
  │ HTTPS
  ▼
Cloudflare Worker
  │
  │ Responses API
  ▼
OpenAI
```

The service worker performs the cross-origin backend request using the extension's host permission. This keeps provider credentials and backend calls outside the page context.

## Backend reuse

Development and testing use the already deployed Worker:

`https://tweetpilot-api.vtrravikumar.workers.dev/v1/tweet/generate`

No second backend or development API key is required for M1.

## Testing

Automated extension tests cover topic resolution, composer detection, search-box exclusion, text extraction, and composer replacement events.

Real-browser validation remains necessary because X's DOM is dynamic and can change independently of the extension.
