# Vichar — Backlog

Updated: 2026-10-09

## Current status

Vichar V1 web experience is live at https://vtrrk.in/vichar/.

The Chrome extension is implemented, packaged with the correct ZIP structure, CI-verified, and submitted to the Chrome Web Store. The current store submission is **pending review** with automatic publishing enabled after approval.

## Completed

### Product
- [x] Human-controlled publishing model
- [x] Topic-based generation
- [x] Optional manually entered location/context
- [x] Custom topic input on web
- [x] Randomised writing style per generation
- [x] 140-character default output
- [x] Required `Vichar by @vtrrk` attribution within the limit
- [x] No automatic posting

### Backend
- [x] Cloudflare Worker production deployment
- [x] OpenAI Responses API integration
- [x] Server-side API key handling
- [x] Short-lived web session tokens
- [x] Extension installation usage limits
- [x] Durable Object usage counters
- [x] Input/output validation
- [x] CORS
- [x] `store: false` for OpenAI requests
- [x] Automated tests and type checking
- [x] Production generation validation

### Web
- [x] VTRRK-style Vichar UI
- [x] Topic selector
- [x] Custom topic
- [x] Optional location
- [x] Editable generated result
- [x] Character counter
- [x] Create another
- [x] **Tweet this** action using X's composer intent URL
- [x] Privacy Policy link
- [x] Chrome extension "Coming soon" teaser
- [x] Responsive/mobile layout

### Chrome extension
- [x] Chrome MV3 foundation
- [x] X composer detection
- [x] In-page Vichar UI
- [x] Topic/location generation inputs
- [x] Randomised style selection
- [x] Editable suggestion
- [x] Use this / Replace draft workflow
- [x] No automatic publishing
- [x] Opaque per-installation usage identifier
- [x] Location not persisted in extension storage
- [x] Extension tests
- [x] Typecheck
- [x] Production build
- [x] CI packaging
- [x] ZIP corrected so `manifest.json` is at archive root
- [x] Chrome Web Store listing
- [x] Privacy/data-use declarations
- [x] Privacy Policy published
- [x] Store submission



## VICHAR-EXT-001 — Show extension version in the embedded X composer UI
- Priority: P2
- Status: Planned
- Area: Chrome extension / UX / Diagnostics
- Consumers: Chrome extension

Display the installed Vichar extension version directly in the embedded Vichar panel on X, near the Vichar brand header, so the active version can be identified without opening Chrome's extension manager. Use the version from the extension's single source of truth (the manifest/build metadata); do not hard-code a second version string in the UI. Keep the label subtle but readable and ensure it works in both light and dark X themes and at narrow widths. Confirm the displayed value matches the packaged extension version in the release artifact. This is a diagnostic UX improvement and must not change generation, posting, privacy or usage-limit behaviour.



## VICHAR-EXT-002 — Paid-plan messaging for generation limits
- Priority: P2
- Status: Planned
- Area: Chrome extension / UX / Monetisation
- Consumers: Chrome extension

When a user hits the current generation rate limit (for example, three requests in one minute), replace the generic “Too many Vichar generation requests. Please try again shortly.” message with plan-aware guidance. While a paid plan is not yet available, keep the message truthful and explain when the user can retry; do not advertise an unavailable subscription or imply that payment already unlocks unlimited use. Once a paid plan and its entitlement checks are implemented, show a clear upgrade/subscribe action and describe the actual paid allowance accurately (use “unlimited” only if the plan truly has no usage cap). Keep transient burst limits distinct from daily/free-tier limits, and test each response path. The backend remains authoritative for limits; this is not a client-only bypass.

## Immediate next steps

### Chrome Web Store
- [ ] Monitor review status
- [ ] Respond to any reviewer questions or rejection feedback
- [ ] Verify public listing after approval
- [ ] Test installation from the public Chrome Web Store
- [ ] Replace the web-page "Coming soon" teaser with a Chrome Web Store link after publication

### Launch
- [ ] Announce https://vtrrk.in/vichar/ on X
- [ ] Encourage beta users to try the web version and provide feedback
- [ ] Once the extension is approved, announce the Chrome extension separately
- [ ] Gather real-world feedback before adding more features

## Post-launch improvements

### UX
- [ ] Evaluate whether `Vichar by @vtrrk` attribution should remain mandatory after beta
- [ ] Improve error/retry messaging if real users encounter failures
- [ ] Consider lightweight generation history only if users request it
- [ ] Improve duplicate-idea avoidance across repeated generations
- [ ] Add graceful fallback for clipboard/browser restrictions where useful
- [ ] Validate X composer behaviour across desktop/mobile web changes

### Usage and operations
- [ ] Monitor backend usage and OpenAI cost
- [ ] Review extension daily/burst limits after real usage
- [ ] Add stronger public-web abuse protection if necessary
- [ ] Monitor Worker errors and generation failures
- [ ] Review privacy policy when data flows or features change

### Product direction
- [ ] Decide whether to support additional post lengths if X account capabilities justify it
- [ ] Evaluate additional writing controls only after observing actual user demand
- [ ] Avoid adding autonomous posting
- [ ] Keep the extension and web experience behaviour aligned

## Explicitly out of scope for V1

- Automatic X posting
- X API integration for publishing
- Background autonomous posting
- Reading or storing X account credentials/cookies
- Persistent GPS/geolocation tracking
- Storing user topics, locations or generated posts in Chrome storage
- Generic social-media automation features

## Release checklist

Before declaring the first public release complete:

- [x] Backend production healthy
- [x] Web Vichar live
- [x] Privacy Policy live
- [x] Extension package valid
- [x] CI green
- [x] Chrome Web Store submission complete
- [ ] Chrome Web Store approval
- [ ] Public installation test
- [ ] Public launch announcement



---

## Repository Ownership & Cross-Repository Dependencies

### Ownership rule

This repository owns the **Vichar backend/API and Chrome extension**: Cloudflare Worker endpoints, OpenAI integration, authentication, usage limits, security, shared generation logic, extension implementation, packaging, and extension-specific UX.

The Vichar website UI at [`vtrrk.in/vichar/`](https://vtrrk.in/vichar/) is owned by [`vtrravikumar/vtrrk.in`](https://github.com/vtrravikumar/vtrrk.in). Website layout, content, SEO, accessibility, image/JavaScript performance, and browser-side website behaviour belong in that repository's backlog.

### Consumer labels (required for backend/API work)

Every backend/API backlog item that changes behaviour or contracts must state its consumer scope using one of these exact labels:

- **Consumers: Website** — Vichar web experience on vtrrk.in.
- **Consumers: Chrome extension** — Vichar extension on X.
- **Consumers: Both** — the website and extension both depend on the change.
- **Consumers: Backend/internal** — no direct client contract change; explain why.

If consumer impact is not yet known, mark it **Consumers: To be assessed** and resolve it before implementation is considered complete. Do not assume a change affects both clients merely because they share a backend.

### Cross-reference rules

1. Backend/API and extension implementation tasks live here. Website UI implementation tasks live in the vtrrk.in backlog.
2. If a website requirement needs a backend change, add the implementation task here and reference the website backlog item. The website backlog should retain its own integration/verification item and link back here.
3. Each cross-repository reference must name the repository and item ID/title, and include a link when the item exists. Never invent an item ID or claim a dependency is linked before it is created.
4. Track implementation and consumer integration independently. A backend task being Done does not prove the website or extension integration works; test every declared consumer.
5. Keep release/deployment verification separate for the Worker, website, and Chrome extension.
6. Do not add speculative backend work just because a client could use it. First agree on the product requirement and the affected consumer(s).

### Vichar V4.0 — News-aware generation

**Design and implementation verified: 2026-10-09.** News mode is merged and deployed for the backend, website and extension. Ravi confirmed the production website renders correctly in light and dark modes and generated a relevant news-based Vichar. This records functional smoke verification, not a guarantee that the provisional news provider is suitable indefinitely.

Vichar will treat the **content source** and **writing style** as separate dimensions. Additional decisions confirmed on 2026-10-09:

- **Initial recency window: 48 hours.** Only stories with a valid publication timestamp within the last 48 hours qualify. Stories older than 48 hours, future-dated, or missing/unparseable publication timestamps are excluded from News mode.
- **Global reach:** retain Google News RSS as the initial provider candidate because topics and locations may be anywhere in the world. Search configuration must not hard-code India-only coverage; use the supplied location to focus the query without restricting sources to Indian publishers. Validate locale/region behaviour during provider proof of concept.
- **Explicit fallback:** if News mode finds no qualifying recent story, generate an ordinary Vichar using OpenAI and the chosen/randomised writing style, and return a machine-readable `normal_fallback` outcome with `fallbackReason: no_recent_news`. The client must visibly state: “No recent news found for this topic. We've generated a normal Vichar instead.”
- **Provider failure is distinct:** if retrieval times out, returns an error, or cannot be parsed, generate an ordinary Vichar if OpenAI is available, but return `fallbackReason: news_unavailable` and show a different message. Never imply that an outage proves no news exists.
- **Successful News mode:** return the draft plus source metadata (headline, publisher, canonical/article URL, publication timestamp) for the selected story/stories. Do not label a draft news-grounded unless at least one source passes relevance and recency checks.

The 48-hour threshold is the initial product default, subject to review after real-world use; do not silently widen it when results are sparse.

- `useNews: true` explicitly requests a post grounded in recent news; `false` or an omitted field preserves ordinary topic-based generation.
- `style` remains a writing-tone attribute (for example, witty, thoughtful, professional). News is **not** a writing style and must not be included in random style selection.
- In News mode, retrieve relevant recent coverage using the topic and optional location, then write an original Vichar in the requested/randomly selected style.
- Return traceable source metadata (headline, publisher, article URL, and publication time when available) alongside the draft.
- If explicit News mode cannot find a suitable source, return a clear no-news/unavailable outcome rather than silently generating a generic post or inventing an event.
- Keep the existing editable-draft/manual-publishing workflow. No automatic publishing.

**Implementation and verification record (2026-10-09):** News retrieval is now explicitly requested through `useNews`; location alone does not trigger it. The backend filters for valid stories published within the last 48 hours, returns source metadata for successful News mode, and distinguishes no qualifying news from provider failure. Website and extension expose the explicit News toggle and fallback state. Backend/extension CI passed, production deployments completed, and Ravi confirmed a relevant news-based draft on the production website. Google News RSS remains the initial provider and should be reviewed for permitted use, reliability and source-link quality before being treated as a permanent dependency.

**Consumers: Both** — the Vichar website and Chrome extension. Backend/API and extension work stays in this repository; website UI/integration stays in `vtrravikumar/vtrrk.in`.

#### Delivery stages

1. **VICHAR-010A — News retrieval contract and provider proof of concept**
   - Status: Done
   - Review the existing Google News RSS implementation for relevance, freshness, article URL extraction, malformed/empty responses, timeouts, and source attribution.
   - Validate the intended production usage, global query/locale behaviour, article URL quality, and provider suitability before treating Google News RSS as a permanent dependency.
   - Define typed retrieval outcomes that distinguish recent results, no qualifying stories (including stale/missing timestamps), and provider failure.
   - Consumers: Backend/internal (proof of concept); no client contract change in this stage.
2. **VICHAR-010B — Backend News mode**
   - Status: Done
   - Validate optional boolean `useNews`; preserve existing behaviour when omitted/false.
   - Keep `style` solely for tone; remove `news` from style-specific behaviour and ensure location alone does not trigger news retrieval.
   - When `useNews: true`, retrieve news independently from OpenAI, reject stories older than 48 hours or with missing/unreliable publication times, and ground the draft in a qualifying source. If no qualifying story exists, use normal OpenAI generation and return an explicit `normal_fallback` / `no_recent_news` outcome; if retrieval fails, use normal generation with `normal_fallback` / `news_unavailable`.
   - Return source metadata in the API response for successful News mode, plus explicit mode/fallback metadata when News mode falls back. Preserve the existing `tweet` response field and existing non-News response compatibility.
   - Test global search configuration, success and source URLs, the 48-hour boundary, stale/missing/future timestamps, no qualifying results, malformed feeds, timeouts/provider failures, distinct fallback reasons, character limits, attribution, and all existing non-News behaviours.
   - Consumers: Both.
3. **VICHAR-010C — Website API contract handoff**
   - Status: Done
   - Document the stable request/response contract and no-news/unavailable semantics for the website consumer.
   - Coordinate with website item [`vtrravikumar/vtrrk.in` — VICHAR-WEB-002](https://github.com/vtrravikumar/vtrrk.in/blob/main/backlog.md).
   - Do not implement website UI in this repository.
   - Consumers: Website.
4. **VICHAR-010D — Chrome extension integration**
   - Status: Done
   - Add the same explicit News option and show source metadata; keep existing writing-style selection independent.
   - Handle no-news/unavailable responses without changing the manual posting flow.
   - Consumers: Chrome extension.

**Provider note:** Google News RSS is the current proof-of-concept candidate because the product needs global coverage, not an India-only publisher feed; it is not a final production commitment. Confirm permitted use, reliability and source-link quality before finalising provider choice. Do not add a paid provider or extra infrastructure without an explicit cost/benefit decision.

**Release note:** Vichar V4.0 News mode was merged and deployed on 2026-10-09. Backend and extension CI passed; the production website and news generation were manually smoke-tested by Ravi. Keep the provider-suitability review as follow-up operational work; do not imply that a smoke test replaces ongoing monitoring.

## VICHAR-PAY-001 — Prepaid credits and one-time free trial

- Priority: P1 (launch monetisation)
- Status: Planned — product direction agreed; implementation details remain open
- Area: Backend/API, website, Chrome extension, payments
- Consumers: Both

### Agreed pricing direction (provisional)

| Pack | Price | Credits / generations | Price per credit |
|---|---:|---:|---:|
| Starter | ₹19 | 1,000 | ₹0.019 |
| Value | ₹49 | 5,000 | ₹0.0098 |
| Power | ₹99 | 15,000 | ₹0.0066 |

These prices are a provisional launch proposal, not yet a public commitment. Validate end-to-end economics—including actual model usage, retries, payment processing fees, applicable taxes/refunds and operational overhead—before publishing or enabling purchases.

### Agreed trial and credit behaviour

- Offer a one-time trial lasting 14 days, with a maximum of 20 successful generations.
- When the trial expires or its allowance is exhausted, generation stops until the user purchases credits.
- Enforce trial eligibility, balances and deductions on the server. Client state must never be authoritative and must not permit users to alter balances.
- Deduct one credit for each successful completed generation. Failed provider/server requests must not silently consume a credit.
- Make payment fulfilment idempotent so duplicate callbacks or retries cannot add the same purchased credits more than once.
- Keep burst/rate limits separate from purchased entitlements; purchasing credits does not imply unlimited request speed or bypass abuse protection.
- Do not introduce automatic publishing. Vichar continues to generate editable drafts for the user to review and post manually.

### Implementation and release checklist

- [ ] Choose the durable identity/account approach for trial eligibility and credit ownership; document privacy and anti-abuse trade-offs before implementation.
- [ ] Select and document a payment provider; verify payments server-side before crediting an account.
- [ ] Design the server-side ledger/balance model, transaction boundaries, idempotency keys and reconciliation/audit path.
- [ ] Define behaviour for provider retries, validation failures, timeouts, duplicate requests and ambiguous outcomes so credits are charged consistently.
- [ ] Decide and publish credit expiry, refund, cancellation, payment-failure and service-shutdown policies; obtain appropriate legal/tax review before launch.
- [ ] Confirm current OpenAI model pricing and measure cost across enough completed generations, including retries. Current Cloudflare telemetry logs per-response token usage but does not yet correlate every provider response with one completed generation.
- [ ] Reassess the provisional pack prices after payment fees, taxes and measured usage are included.
- [ ] Implement consistent balance/trial/low-credit/exhausted-credit UX in both the website and extension; the backend remains authoritative.
- [ ] Add tests for concurrent requests, trial reuse, expired trials, insufficient balance, failed generations, duplicate payment events, refunds and ledger consistency.
- [ ] Add operational monitoring for payment reconciliation, credit grants/deductions and unusual abuse without logging prompts or generated content.
- [ ] Verify end-to-end in a payment sandbox before enabling live payments.

### Open decisions / guardrails

- Payment provider is not selected. Razorpay may be evaluated, but is not an approved decision.
- The identity strategy is not selected; an installation identifier alone may be easier to abuse than an account-bound balance.
- Credit expiry and refund policy are not yet decided.
- Do not advertise unlimited use unless the actual entitlement and safeguards support that claim.
- Do not enable purchases or present these prices as final until the above launch gates are reviewed.

