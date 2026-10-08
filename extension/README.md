# Vichar Chrome Extension — By VTRRK

The Vichar Chrome extension brings Vichar into the X composer as a human-controlled writing companion.

## Brand

**Vichar — By VTRRK**

Tagline: **From thought to expression.**

The extension UI uses an X-native neutral visual treatment so it feels at home inside X. Vichar's product identity remains distinct through its name, wording, and approved Vichar artwork.

## Product rule

**Vichar assists the X composer; it does not control the X composer.**

When an X Post composer opens, Vichar defaults to **Surprise me** and waits for the user to request a thought. No OpenAI request is made merely because the composer opened.

The user can:

1. **Get a thought** — explicitly ask for a suggestion.
2. **Use this** — place the suggestion into the X composer.
3. **Another thought** — generate another suggestion.
4. **Dismiss** — hide Vichar and write a completely normal X post.

The user can also ignore the panel and type directly into X at any time.

Vichar never clicks X's native **Post** button.

## Production backend

The extension uses the deployed Vichar Cloudflare Worker:

`https://api.vtrrk.in/vichar`

The OpenAI API key is never shipped to the extension. The extension generates an opaque per-installation Vichar usage key, stores it in extension-local storage, and sends it to the Cloudflare Worker as a Bearer token. The backend uses that identifier for usage accounting and enforces the free quota (10 generations/day, 3/minute burst by default). It is not an OpenAI credential or API secret.

## Local build

From the repository root:

```bash
cd extension
npm install
npm test
npm run typecheck
npm run build
```

The unpacked extension is generated in `extension/dist/`.

## Load in Chrome

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `vichar/extension/dist`.
5. Open or reload `https://x.com/`.
6. Open the X **Post** composer.

For clean integration testing, temporarily disable other X-composer extensions such as TweetAI so their DOM/UI changes do not interfere with the first Vichar test.

## Permissions and access

The extension requests:

- `storage` for the optional location preference and installation usage identifier.
- Host access to the Vichar Cloudflare Worker for generation requests.
- Content-script matches for `x.com` and `twitter.com` so Vichar can detect and assist the X composer.

It does not request broad access to unrelated websites, X APIs, cookies, tabs, history, or geolocation.

## Human-controlled publishing

The extension only assists with composing. The final X Post action remains entirely native to X and entirely under the user's control.

Platform rules and policies may apply to browser extensions and automation on X; this project does not claim platform approval.

## V1 scope

V1 is intentionally limited to:

- generating short English-first thoughts for the X composer;
- topic selection and optional user-entered location context;
- explicit user-controlled insertion into the composer;
- server-enforced free usage limits;
- no automatic publishing;
- no X API integration;
- no browser geolocation;
- no OpenAI credential in the extension.

Current-information/web-search generation is deferred to a later product phase.
