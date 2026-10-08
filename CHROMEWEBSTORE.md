# Chrome Web Store Readiness — Vichar

This file records information needed for eventual Chrome Web Store submission and is maintained alongside the extension.

## Product

**Name:** Vichar — By VTRRK

**Purpose:** A thoughtful AI writing companion for the X composer. Vichar generates short suggestions that the user may edit and explicitly place into an X draft. The user always performs the final X Post action.

**V1 distribution status:** Development / unpacked extension validation. Not yet submitted to the Chrome Web Store.

## Single purpose

Vichar has one primary purpose: assist a user in drafting posts for the X composer with AI-generated suggestions.

It does not automatically publish posts, access the X API, or silently replace user-written content.

## Permissions and justifications

### `storage`

**Justification:** Stores the user's optional location preference and an opaque per-installation usage identifier used by the Vichar backend for quota accounting.

No passwords, OpenAI credentials, X credentials, or authentication cookies are stored by the extension.

### Host access: Vichar Cloudflare Worker

**Host:** `https://api.vtrrk.in/vichar/*`

**Justification:** The MV3 service worker sends generation requests to the Vichar backend. The backend holds the OpenAI credential and enforces usage limits, so the OpenAI API key does not need to be included in the extension.

### Content-script matches: X

**Matches:** `https://x.com/*`, `https://twitter.com/*`

**Justification:** Vichar must observe the X page to detect the native composer, display its companion UI, and — only after explicit user action — place the selected suggestion into the X draft.

Vichar does not use these matches to publish posts automatically.

## Data handling

The extension sends generation requests containing:

- selected topic;
- optional location entered by the user;
- requested writing style;
- maximum tweet length.

The extension does not intentionally collect or transmit:

- X account credentials;
- passwords;
- cookies;
- browsing history;
- browser geolocation;
- the user's X account identity;
- the user's existing X draft as part of generation requests.

The generated suggestion is returned from the Vichar backend and remains under the user's control until they explicitly choose **Use this**.

## Security model

- Manifest V3.
- OpenAI API key remains server-side.
- Backend usage protection is enforced server-side.
- Installation usage identifier is opaque and generated locally.
- No X API credential.
- No automatic X Post action.
- No geolocation permission.
- Extension requests only the permissions needed for its V1 purpose.

## V1 limitations

Real-browser validation against X's live DOM is required before treating the extension as production-ready.

Chrome Web Store submission, store listing copy, screenshots, privacy disclosures, and final policy review remain separate release activities.
