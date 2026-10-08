# Vichar — By VTRRK

Vichar is a personal AI-assisted writing companion for X (formerly Twitter).

It is designed to help turn an idea into a concise, personal post while keeping the important parts human-controlled: **review, editing and the final decision to publish**.

The production web client is live at [vtrrk.in/vichar/](https://vtrrk.in/vichar/). The Chrome extension is packaged, CI-verified, submitted to the Chrome Web Store, and currently pending review.

> **Status: V1 web experience live; Chrome extension submitted to the Chrome Web Store and pending review**
>
> The backend is production deployed and hardened, the web client is live, and the Chrome extension has passed packaging CI and been submitted for Chrome Web Store review. The production generation path has been revalidated through the web session and OpenAI provider.

---

## What Vichar does

Vichar generates short, personalized tweet drafts based on:

- **Technology & AI**
- **Photography**
- **Royal Enfield & Riding**
- **Travel & Exploration**
- **Life & Observations**
- **Surprise me**

The request can also include optional location context and a writing style such as `thoughtful`.

The generated tweet is returned to the user for review and editing. Vichar does **not** automatically publish the final post.

### Current workflow

```text
Choose a topic
     ↓
Generate a tweet
     ↓
Review / edit
     ↓
Review / edit
     ↓
Tweet this → X composer
     ↓
User presses X's native Post button
```

This separation is deliberate. Vichar is an assistant, not an autonomous publisher.

---

## Live version

### Vichar

**https://vtrrk.in/vichar/**

The current web client provides:

- topic selection;
- optional location context;
- AI tweet generation;
- 140-character counting by default;
- randomised writing style per generation;
- editable tweet text;
- Create Another;
- Tweet this, opening X with the edited text pre-filled;
- manual publication through X.

The current character limit is configured for a non-Premium X account and is not treated as a permanent Vichar limit.

---

## Architecture

Vichar is intentionally small and cost-conscious.

```text
┌──────────────────────────┐
│       vtrrk.in/tweet     │
│      Astro web client    │
└────────────┬─────────────┘
             │ HTTPS
             ▼
┌──────────────────────────┐
│   Cloudflare Worker      │
│      vichar-api      │
│                          │
│  HTTP validation         │
│  CORS                    │
│  TweetGenerator          │
│  OpenAI provider         │
└────────────┬─────────────┘
             │ Responses API
             ▼
┌──────────────────────────┐
│          OpenAI          │
└──────────────────────────┘
```

### Backend

- Cloudflare Workers
- TypeScript
- Wrangler
- OpenAI Responses API
- Vitest
- Cloudflare Workers Vitest pool
- No conventional database; Durable Object SQLite stores only anonymous usage counters
- Durable usage protection for extension installations; Vichar web generation is unlimited in V1
- No dedicated server or VM
- No Docker/Kubernetes requirement

### Web client

The initial web client lives in the separate **vtrrk.in** Astro repository.

The production API is:

```
https://api.vtrrk.in/vichar
```

---

## API

The main endpoint is:

```
POST /v1/tweet/generate
```

Example request:

```json
{
  "topic": "Photography",
  "location": "Chennai",
  "style": "thoughtful",
  "maxLength": 140
}
```

Example response:

```json
{
  "tweet": "Good photographs don't always reveal more. Sometimes they simply make you notice what you'd been walking past."
}
```

### Health check

```
GET /health
```

Production:

```
https://api.vtrrk.in/vichar/health
```

---

## Generation design

The backend separates the HTTP layer from the generation provider through a `TweetGenerator` interface.

This keeps the API independent of the AI provider and allows another provider to be introduced later without changing the HTTP contract.

The current production provider is OpenAI.

The generator:

- uses the OpenAI Responses API directly;
- keeps the API key server-side;
- does not expose credentials to the browser;
- uses a configurable model;
- defaults to a cost-conscious generation configuration;
- derives an output-token budget from the requested tweet length;
- limits oversized prompt fields;
- validates the returned tweet length;
- enforces the exact final `Vichar by @vtrrk` attribution and counts it within `maxLength`;
- prevents duplicate attribution variants from model output;
- prevents unapproved links;
- allows one corrective generation when the output violates length/link rules;
- does not store responses through the OpenAI request (`store: false`);
- does not silently fall back to placeholder content in production.

The current default model is configured in code but can be overridden through the Worker environment.

---

## Personalization

Vichar is intended for V.T.R. Ravi Kumar's personal voice and interests rather than generic social-media copy.

The current personalization favours:

- conversational writing;
- thoughtful observations;
- occasional wit;
- fresh angles;
- natural language;
- minimal hashtags;
- avoiding repetitive rhetorical patterns;
- avoiding generic engagement bait.

Location is optional context supplied by the user. Vichar does not require precise location tracking.

---

## Links

VTRRK links can be configured separately from the generation prompt.

The backend supports an optional `VTRRK_LINKS` JSON configuration. Links are selected deterministically by topic where configured, rather than asking the model to invent URLs.

If no links are configured, the generator does not add links.

---

## Configuration

The Worker reads these values from its environment:

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Server-side OpenAI credential |
| `OPENAI_MODEL` | No | Override the default model |
| `OPENAI_REASONING_EFFORT` | No | Override reasoning effort; `omit` removes the field |
| `VTRRK_LINKS` | No | JSON configuration of topic-specific VTRRK links |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated browser origins allowed to call the API |
| `TWEETPILOT_GENERATOR` | No | Set to `placeholder` only for offline/test generation |
| `VICHAR_DAILY_LIMIT` | No | Extension installation daily generation limit; production default is `10` |
| `VICHAR_BURST_PER_MINUTE` | No | Extension installation per-minute generation limit; production default is `3` |
| `VICHAR_WEB_SECRET` | Yes for web session access | Server-side secret used to issue short-lived Vichar web session tokens |

**Never commit an API key or `.dev.vars` to Git.**

For local development, the API key can be placed in:

```text
backend/.dev.vars
```

That file is intended to remain outside source control.

---

## Local development

From the repository root:

```bash
cd backend
npm install
```

Start the local Worker:

```bash
npm run dev
```

The local Worker normally runs at:

```
http://localhost:8787
```

Run tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

Deploy the Worker:

```cd backend
npm run deploy
```

Wrangler configuration lives in:

```text
backend/wrangler.jsonc
```

---

## Testing philosophy

Tests are designed so the automated suite does not make real OpenAI requests.

The provider supports dependency-injected `fetch` implementations, allowing upstream behaviour to be tested deterministically.

The test suite covers areas including:

- request validation;
- malformed JSON;
- method handling;
- generation provider behaviour;
- output length handling;
- link rules;
- upstream failures;
- timeout handling;
- malformed provider responses;
- CORS;
- placeholder generation;
- configuration behaviour.

The production OpenAI path is validated separately through controlled real requests.

---

## CORS

The API uses an explicit origin allow-list.

The current production web client origin is:

```text
https://vtrrk.in
```

The implementation deliberately avoids wildcard CORS and does not enable credentials.

Chrome extension origins are supported once the production extension ID is known.

CORS is a browser access-control mechanism, not authentication. Vichar's web client uses a short-lived server-issued session token and is intentionally unlimited in V1. The Chrome extension uses Durable Object-backed per-installation usage protection.

---

## Cost-conscious design

Vichar is intentionally designed to keep AI costs low.

Current principles:

- one generation call per normal request;
- compact prompts;
- optional single corrective retry only when required;
- bounded input fields;
- bounded output tokens;
- no web search;
- no embeddings;
- no conventional database; usage counters are stored in a small SQLite-backed Durable Object;
- no unnecessary background processing;
- automated tests never call the real OpenAI API.

The initial deployment uses the existing production OpenAI API setup. Provider and model choices remain configurable so they can be changed later without redesigning the application.

---

## Roadmap

### M0 — Product definition

**Complete**

- product direction;
- human-controlled publishing model;
- topic model;
- personalization requirements;
- API contract;
- cost constraints.

### M2 — Backend and AI generation

**Complete**

- Cloudflare Worker;
- generation abstraction;
- OpenAI provider;
- prompt/personalization logic;
- validation;
- length enforcement;
- link handling;
- CORS;
- automated tests;
- production deployment.

### Web Vichar

**Complete**

- vtrrk.in integration;
- topic selector;
- optional location;
- generated tweet editor;
- character counter;
- Create Another;
- Tweet this action, opening X's composer with the edited text pre-filled;
- custom topic input;
- randomised writing style per generation;
- Vichar Chrome extension teaser;
- Privacy Policy link;
- live production validation.

### M1 — Chrome extension

**Submitted — pending Chrome Web Store review**

The extension brings Vichar directly into the X composer and is now submitted for Chrome Web Store review.

Planned capabilities include:

- Chrome MV3 extension foundation;
- X composer detection;
- non-blocking in-page Vichar UI;
- Surprise me as the default topic;
- optional topic selection and location context;
- generation through the production backend;
- editable suggestion;
- explicit Use this / Another / Dismiss workflow;
- user-controlled insertion into the composer;
- native X Post remains the final action;
- automated extension tests and CI verification;
- production package with manifest.json at ZIP root;
- Chrome Web Store listing, privacy declarations, test instructions and privacy policy.

The extension will **not** automatically click X's native Post button. The user explicitly chooses **Use this** before content is inserted.

### M3 — Hardening and product completion

Core backend hardening is complete. Remaining M3 work is product refinement and broader extension/web experience validation.

Planned areas include:

- draft/history support;
- better duplicate avoidance across requests;
- copy fallbacks;
- integration hardening;
- extension UX refinement;
- production abuse/rate limiting for the public web client if usage becomes excessive;
- broader end-to-end validation.

---

## Repository structure

```text
vichar/
├── backend/
│   ├── src/
│   │   ├── generation/
│   │   ├── http/
│   │   ├── routes/
│   │   ├── usage/
│   │   ├── validation/
│   │   ├── env.ts
│   │   ├── router.ts
│   │   └── index.ts
│   ├── test/
│   ├── package.json
│   └── wrangler.jsonc
└── README.md
```

The repository now includes the Chrome extension under `extension/`.

---

## Related

- **Live Vichar:** https://vtrrk.in/vichar/
- **Personal website:** https://vtrrk.in/
- **Vichar API:** https://api.vtrrk.in/vichar/
- **VTRRK GitHub:** https://github.com/vtrravikumar
- **Vichar project page:** https://vtrrk.in/vichar/

---

## Design principles

Vichar follows a few simple principles:

1. **AI assists; the human decides.**
2. **The generated text should sound personal, not generic.**
3. **Keep the architecture small until scale requires more.**
4. **Keep AI costs predictable.**
5. **Never expose provider credentials to the browser.**
6. **Prefer deterministic application logic where the model does not need to make the decision.**
7. **Build the backend independently before coupling it tightly to the X UI.**

---

## Disclaimer

Vichar is an independent personal project and is not affiliated with or endorsed by X Corp.

The Chrome extension is intended as an assistant for composing posts. Platform rules and policies may apply to browser extensions and automation on X; the project does not claim platform approval.

---

© V.T.R. Ravi Kumar
