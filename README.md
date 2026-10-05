# TweetPilot — By VTRRK

TweetPilot is a personal AI-assisted writing companion for X (formerly Twitter).

It is designed to help turn an idea into a concise, personal post while keeping the important parts human-controlled: **review, editing and the final decision to publish**.

The first production version is already live as a web-based Tweet Creator on [vtrrk.in](https://vtrrk.in/tweet/). The next major step is a Chrome extension that will bring the same workflow into the X composer.

> **Status: Active development**
>
> The backend is production deployed, the web client is live, and the first TweetPilot-generated post has been reviewed and manually published on X.

---

## What TweetPilot does

TweetPilot generates short, personalized tweet drafts based on:

- **Technology & AI**
- **Photography**
- **Royal Enfield & Riding**
- **Travel & Exploration**
- **Life & Observations**
- **Surprise me**

The request can also include optional location context and a writing style such as `thoughtful`.

The generated tweet is returned to the user for review and editing. TweetPilot does **not** automatically publish the final post.

### Current workflow

```text
Choose a topic
     ↓
Generate a tweet
     ↓
Review / edit
     ↓
Copy to X
     ↓
User presses X's native Post button
```

This separation is deliberate. TweetPilot is an assistant, not an autonomous publisher.

---

## Live version

### Tweet Creator

**https://vtrrk.in/tweet/**

The current web client provides:

- topic selection;
- optional location context;
- AI tweet generation;
- 140-character counting by default;
- editable tweet text;
- Create Another;
- Copy Tweet;
- manual publication through X.

The current character limit is configured for a non-Premium X account and is not treated as a permanent TweetPilot limit.

---

## Architecture

TweetPilot is intentionally small and cost-conscious.

```text
┌──────────────────────────┐
│       vtrrk.in/tweet     │
│      Astro web client    │
└────────────┬─────────────┘
             │ HTTPS
             ▼
┌──────────────────────────┐
│   Cloudflare Worker      │
│      tweetpilot-api      │
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
- No database currently
- No dedicated server or VM
- No Docker/Kubernetes requirement

### Web client

The initial web client lives in the separate **vtrrk.in** Astro repository.

The production API is:

```
https://tweetpilot-api.vtrravikumar.workers.dev
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
https://tweetpilot-api.vtrravikumar.workers.dev/health
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
- prevents unapproved links;
- allows one corrective generation when the output violates length/link rules;
- does not store responses through the OpenAI request (`store: false`);
- does not silently fall back to placeholder content in production.

The current default model is configured in code but can be overridden through the Worker environment.

---

## Personalization

TweetPilot is intended for V.T.R. Ravi Kumar's personal voice and interests rather than generic social-media copy.

The current personalization favours:

- conversational writing;
- thoughtful observations;
- occasional wit;
- fresh angles;
- natural language;
- minimal hashtags;
- avoiding repetitive rhetorical patterns;
- avoiding generic engagement bait.

Location is optional context supplied by the user. TweetPilot does not require precise location tracking.

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

CORS is a browser access-control mechanism, not authentication or abuse protection. Durable rate limiting is planned for a broader public rollout.

---

## Cost-conscious design

TweetPilot is intentionally designed to keep AI costs low.

Current principles:

- one generation call per normal request;
- compact prompts;
- optional single corrective retry only when required;
- bounded input fields;
- bounded output tokens;
- no web search;
- no embeddings;
- no database;
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

### Web Tweet Creator

**Complete**

- vtrrk.in integration;
- topic selector;
- optional location;
- generated tweet editor;
- character counter;
- Create Another;
- Copy Tweet;
- live production validation.

### M1 — Chrome extension

**Next**

The extension will bring TweetPilot into the X composer.

Planned capabilities include:

- Chrome MV3 extension;
- X composer detection;
- in-page TweetPilot UI;
- topic selection;
- generation through the production backend;
- editable output;
- user-controlled insertion/copy workflow.

The extension will **not** automatically click X's native Post button.

### M3 — Hardening and product completion

Planned areas include:

- draft/history support;
- better duplicate avoidance across requests;
- copy fallbacks;
- integration hardening;
- extension UX refinement;
- production abuse/rate limiting;
- broader end-to-end validation.

---

## Repository structure

```text
tweetpilot/
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

The repository is expected to grow to include the Chrome extension as M1 is implemented.

---

## Related

- **Live Tweet Creator:** https://vtrrk.in/tweet/
- **Personal website:** https://vtrrk.in/
- **TweetPilot API:** https://tweetpilot-api.vtrravikumar.workers.dev/
- **VTRRK GitHub:** https://github.com/vtrravikumar
- **TweetPilot project page:** https://vtrrk.in/projects/tweetpilot/

---

## Design principles

TweetPilot follows a few simple principles:

1. **AI assists; the human decides.**
2. **The generated text should sound personal, not generic.**
3. **Keep the architecture small until scale requires more.**
4. **Keep AI costs predictable.**
5. **Never expose provider credentials to the browser.**
6. **Prefer deterministic application logic where the model does not need to make the decision.**
7. **Build the backend independently before coupling it tightly to the X UI.**

---

## Disclaimer

TweetPilot is an independent personal project and is not affiliated with or endorsed by X Corp.

The Chrome extension is intended as an assistant for composing posts. Platform rules and policies may apply to browser extensions and automation on X; the project does not claim platform approval.

---

© V.T.R. Ravi Kumar
