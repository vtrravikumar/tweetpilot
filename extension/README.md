# TweetPilot Chrome Extension — By VTRRK

The TweetPilot Chrome extension is the M1 integration of TweetPilot into the X composer.

## Product rule

**TweetPilot assists the X composer; it does not control the X composer.**

When an X Post composer opens, TweetPilot defaults to **Surprise me** and waits for the user to request a tweet. No OpenAI request is made until the user chooses **Get a Tweet**.

The user can:

1. **Get a Tweet** — explicitly ask for a suggestion.
2. **Use this** — place the suggestion into the X composer.
3. **Get Another** — generate another suggestion.
4. **Dismiss** — hide TweetPilot and write a completely normal X post.

The user can also ignore the panel and type directly into X at any time.

TweetPilot never clicks X's native Post button.

## Development backend

The extension uses the existing production Cloudflare Worker during development and testing:

`https://tweetpilot-api.vtrravikumar.workers.dev`

The OpenAI API key is never shipped to the extension. The extension sends a message to its MV3 service worker, which calls the Cloudflare Worker.

## Local build

From the repository root:

```bash
cd extension
npm install
npm test
npm run typecheck
npm run build
```

The unpacked extension is generated in:

```
extension/dist/
```

## Load in Chrome

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `tweetpilot/extension/dist`.
5. Open or reload `https://x.com/`.
6. Open the X **Post** composer.

For clean integration testing, temporarily disable other X-composer extensions such as TweetAI so their DOM/UI changes do not interfere with the first TweetPilot test.

## Permissions

The extension requests:

- `storage` for the optional location preference.
- host access to the TweetPilot Cloudflare Worker.
- content-script access to `x.com` and `twitter.com`.

It does not request broad access to unrelated websites, X APIs, cookies, tabs, history, or geolocation.

## Human-controlled publishing

The extension only assists with composing. The final X Post action remains entirely native to X and entirely under the user's control.

Platform rules and policies may apply to browser extensions and automation on X; this project does not claim platform approval.
