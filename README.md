# Vichar — By VTRRK

Vichar is a personal AI-assisted writing companion for X (formerly Twitter).

It is designed to help turn an idea into a concise, personal post while keeping the important parts human-controlled: **review, editing and the final decision to publish**.

The production web client is live at [vtrrk.in/vichar/](https://vtrrk.in/vichar/). The Chrome extension is packaged, CI-verified, submitted to the Chrome Web Store, and currently pending review.

> **Status: V1 web experience live; Chrome extension submitted to the Chrome Web Store and pending review**
>
> The backend is production deployed and hardened, the web client is live, and the Chrome extension has passed packaging CI and been submitted for Chrome Web Store review. Website generation uses a short-lived first-party web session mapped server-side to owner entitlement. A production smoke test confirmed generation works without a website license-key prompt.

## What Vichar does

Vichar generates short, personalized tweet drafts based on:

- **Technology & AI**
- **Photography**
- **Royal Enfield & Riding**
- **Travel & Exploration**
- **Life & Observations**
- **Surprise me**

The request can also include optional location context, a writing style such as `thoughtful`, and an optional recent-news mode.

The generated tweet is returned to the user for review and editing. Vichar does **not** automatically publish the final post.

### Current workflow

```text
Choose a topic
     ↓
Generate a tweet
     ↓
Review / edit
     ↓
Tweet this → X composer
     ↓
User presses X's native Post button
```

This separation is deliberate. Vichar is an assistant, not an autonomous publisher.

## Live version

### Vichar

**https://vtrrk.in/vichar/**

The current web client provides:

- topic selection and custom topic input;
- optional location context;
- optional recent-news generation, with source links when available;
- AI tweet generation;
- 140-character counting by default;
- randomised writing style per generation;
- editable tweet text;
- Create Another;
- Tweet this, opening X with the edited text pre-filled;
- manual publication through X.

The current character limit is configured for a non-Premium X account and is not treated as a permanent Vichar limit.

## Architecture

Vichar is intentionally small and cost-conscious.

```text
vtrrk.in Astro web client
       │ POST /v1/web/session (first-party Origin)
       ▼
Cloudflare Worker ── issues 10-minute signed web token
       │
       │ POST /v1/tweet/generate + Bearer token
       ▼
Owner entitlement path ── owner burst guard
       │
       ▼
TweetGenerator / OpenAI Responses API
```

The extension uses a separate route through the same generation endpoint with its license key and server-side credit balance.

### Backend

- Cloudflare Workers
- TypeScript
- Wrangler
- OpenAI Responses API
- Vitest
- Cloudflare Workers Vitest pool
- No conventional database; Durable Object SQLite stores usage, license balances and burst-control state
- Durable usage protection for extension installations; website generations use owner entitlement and do not consume extension credits
- No dedicated server or VM
- No Docker/Kubernetes requirement

### Web client

The web client lives in the separate **vtrrk.in** Astro repository.

- Website source: [`src/pages/vichar.astro`](https://github.com/vtrravikumar/vtrrk.in/blob/main/src/pages/vichar.astro)
- Website integration notes: [`docs/VICHAR.md`](https://github.com/vtrravikumar/vtrrk.in/blob/main/docs/VICHAR.md)
- Production API base: `https://api.vtrrk.in/vichar`

## Website session and owner entitlement

The website does not ask visitors for a license key and does not store one in browser storage.

1. The frontend requests `POST /v1/web/session` from the exact allowed origin `https://vtrrk.in`.
2. The Worker requires `VICHAR_WEB_SECRET` and issues a signed HMAC-SHA-256 token with audience `vichar-web` and a 10-minute lifetime. The response is marked `Cache-Control: no-store`.
3. The frontend keeps the token in memory and sends it as a Bearer token to `POST /v1/tweet/generate`; it refreshes the session when close to expiry and clears it after an authentication failure.
4. The generation route verifies the signature, expiry, audience and first-party origin.
5. A valid web token maps to the existing owner entitlement. The Worker requires `VICHAR_OWNER_LICENSE_KEY` to be configured, uses its hash for the owner burst-control namespace, and returns owner headers including `x-vichar-access: owner` and `x-vichar-remaining: unlimited`.
6. Owner generation omits the free-tier attribution and does not consume extension credits. The shared owner burst guard still applies.
7. If the owner key is missing, website generation fails closed with `503 owner_entitlement_unavailable`; it does not fall back to the extension's anonymous/free usage path.

The owner key and web-signing secret are Worker-side secrets. Neither is sent to website JavaScript. The website token is not a license key and is not persisted in localStorage.

### Extension entitlement remains separate

- Owner license key: unlimited generation, no free-tier attribution, owner burst protection.
- Free extension license: server-controlled free credit balance and required attribution.
- Paid extension license: server-controlled purchased credit balance and the configured attribution policy.
- A valid website session is treated as owner entitlement only on the website's allowed first-party origin; it does not change extension license credit handling.

## API

### Create a web session

```http
POST /v1/web/session
Origin: https://vtrrk.in
Content-Type: application/json

{}
```

Successful response (token redacted):

```json
{
  "token": "<signed-short-lived-token>",
  "expiresIn": 600
}
```

A disallowed/missing origin receives `403 forbidden_origin`. Missing `VICHAR_WEB_SECRET` returns `503 web_session_unavailable`.

### Generate a tweet

```http
POST /v1/tweet/generate
Origin: https://vtrrk.in
Authorization: Bearer <signed-short-lived-token>
Content-Type: application/json

{
  "topic": "Photography",
  "location": "Chennai",
  "style": "thoughtful",
  "maxLength": 140
}
```

Successful owner response includes the tweet body and headers:

- `x-vichar-access: owner`
- `x-vichar-remaining: unlimited`

Missing owner entitlement configuration returns `503 owner_entitlement_unavailable`. Burst protection may return `429 rate_limited`.

### Extension generation

The extension continues to send its license key as a Bearer token. The backend validates the key, applies its entitlement and credit rules, enforces burst protection, and reports the remaining balance. Do not change extension request semantics when modifying the website session flow.

### Health check

`GET /health`

Production:

`https://api.vtrrk.in/vichar/health`

Returns:

```json
{ "status": "ok" }
```

The health route does not call OpenAI and does not expose internal configuration.

## Generation design

The backend separates the HTTP layer from the generation provider through a `TweetGenerator` interface. The current production provider is OpenAI.

The generator:

- uses the OpenAI Responses API directly;
- keeps the API key server-side;
- uses a configurable model and bounded output-token budget;
- limits oversized prompt fields;
- validates returned tweet length and allowed links;
- applies attribution according to server-side entitlement;
- allows one corrective generation when output violates length/link rules;
- uses `store: false` on OpenAI requests;
- does not silently fall back to placeholder content in production.

The default model is configured in code and can be overridden through the Worker environment.

## Personalization and news

Vichar supports conversational, thoughtful, witty, observational, curious, provocative, inspirational and minimalist styles. The website selects a style for each generation. Location is optional context supplied by the user; precise location tracking is not required.

The website can optionally request recent-news mode. When news is available, the response can include source metadata for display. If recent news is unavailable or no sufficiently recent stories are found, the backend can return a normal-generation fallback with a reason. Source URLs are validated by the frontend before rendering links.

## Configuration and secrets

Production values are configured through Cloudflare Worker secrets/variables, not committed files.

| Name | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Server-side OpenAI credential |
| `VICHAR_WEB_SECRET` | Yes for website session access | Signs short-lived first-party web tokens |
| `VICHAR_OWNER_LICENSE_KEY` | Yes for owner entitlement | Server-side owner key used to identify owner entitlement; never expose it to the browser |
| `CORS_ALLOWED_ORIGINS` | Yes for browser access | Exact allowed browser origins, including `https://vtrrk.in` and the production extension origin as appropriate |
| `OPENAI_MODEL` | No | Override the default model |
| `OPENAI_REASONING_EFFORT` | No | Override reasoning effort |
| `VTRRK_LINKS` | No | JSON configuration of topic-specific VTRRK links |
| `VICHAR_DAILY_LIMIT` | No | Extension per-installation daily limit |
| `VICHAR_BURST_PER_MINUTE` | No | Per-minute burst protection setting |
| `TWEETPILOT_GENERATOR` | No | Set to `placeholder` only for offline/test generation |

Do not commit secrets, API keys, or `backend/.dev.vars`. Never add `VICHAR_OWNER_LICENSE_KEY` or `VICHAR_WEB_SECRET` to Astro frontend environment variables or client-side bundles.

## Local development

```bash
cd backend
npm install
npm run dev
npm test
npm run typecheck
```

Local secrets belong in `backend/.dev.vars`, which must remain outside source control.

Deploy the Worker only after the normal review/approval process:

```bash
cd backend
npm run deploy
```

## Testing philosophy

Automated tests should not make real OpenAI requests. Dependency-injected fetch implementations are used to test upstream behaviour deterministically.

The test suite covers request validation, provider behaviour, output length, attribution, link rules, upstream failures, timeout handling, CORS, license routes, web-token validation, web owner entitlement, burst limits and fail-closed configuration.

The production web flow was smoke-tested after deployment: website generation succeeded without a license-key prompt.

## Roadmap

- **M0 — Product definition:** complete.
- **M2 — Backend and AI generation:** complete.
- **Web Vichar:** live; web sessions use owner entitlement.
- **M1 — Chrome extension:** submitted to Chrome Web Store; pending review.
- **M3 — Hardening/product refinement:** continue end-to-end validation, monitoring and abuse-control review if public usage grows.

## Repository structure

```text
tweetpilot/
├── backend/
│   ├── src/generation/
│   ├── src/http/
│   ├── src/routes/
│   ├── src/usage/
│   ├── src/validation/
│   ├── src/webAuth.ts
│   ├── src/router.ts
│   └── src/index.ts
├── backend/test/
├── extension/
└── docs/
```

## Related

- **Live Vichar:** https://vtrrk.in/vichar/
- **Personal website:** https://vtrrk.in/
- **Vichar API:** https://api.vtrrk.in/vichar/
- **Website implementation:** https://github.com/vtrravikumar/vtrrk.in/blob/main/src/pages/vichar.astro
- **Website integration notes:** https://github.com/vtrravikumar/vtrrk.in/blob/main/docs/VICHAR.md

## Design principles

1. **AI assists; the human decides.**
2. **Keep the architecture small until scale requires more.**
3. **Keep AI costs predictable.**
4. **Never expose provider credentials or owner secrets to the browser.**
5. **Use server-side entitlement as the source of truth.**
6. **Keep website owner access distinct from extension free/paid credit balances.**

## Disclaimer

Vichar is an independent personal project and is not affiliated with or endorsed by X Corp. Vichar generates drafts; the user remains responsible for reviewing and manually publishing posts.

---

© V.T.R. Ravi Kumar
