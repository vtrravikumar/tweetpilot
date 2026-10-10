# Vichar — Backlog

Updated: 2026-10-10

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
- [ ] Review free-tier `Vichar by @vtrrk` attribution after launch feedback
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

## VICHAR-PAY-001 — Extension licensing, free trial and prepaid credits

- Priority: P1 (extension monetisation)
- Status: Product direction agreed; implementation planned
- Area: Backend/API, Chrome extension, Razorpay payments
- Consumers: Chrome extension. The website is a separate, free product surface.

### Product boundary

- **Vichar website (vtrrk.in/vichar): remains free.** Website generations must not consume extension trial or purchased credits. Keep website access/session handling separate from extension entitlement checks.
- **Vichar Chrome extension: monetised through a one-time free trial and prepaid credit packs.**
- The extension offers **Get 50 free generations** and **Activate with an existing key**. Free users receive a license automatically from the backend; no payment gateway or manual key entry is required for the free trial.
- The free allowance is granted once per eligible identity, has no time-based expiry or recurring daily quota in the initial plan, and is enforced server-side.
- After the 50 free generations are exhausted, extension generation stops until the user purchases credits.
- Paid credit packs are provisional: ₹19 for 1,000 generations, ₹49 for 5,000, and ₹99 for 15,000. Razorpay is the selected payment provider; use sandbox first and do not enable live purchases before end-to-end checks.
- A reusable random license key is shared across devices without device-count restrictions. Store only a key hash server-side; the backend owns the balance. Subsequent purchases add credits to the same license.
- Ravi has a permanent server-controlled owner entitlement for the extension: no credit counter or payment, while retaining basic infrastructure safeguards.
- Keep `Vichar by @vtrrk` attribution for free extension generations; omit it for valid paid-license and owner generations. The free website retains its existing website behaviour and must not inherit extension credit rules.
- One credit is deducted only for each successful completed extension generation. Failed generations must not silently consume credits. Balance must never become negative; backend balance is authoritative. Basic rate/burst protections remain separate from credits.
- No automatic publishing. Vichar continues to generate editable drafts for manual review and posting.

### Implementation sequence

- [ ] **PAY-001A — Backend license and credit ledger:** introduce hashed license credentials, one-time free-grant eligibility, authoritative balances, owner entitlement, and atomic credit deductions. Preserve free website access and existing web-session flow. Add focused tests for grants, activation, balance, failed generation and concurrency.
- [ ] **PAY-001B — Extension activation and balance UX:** add Get 50 free generations and Activate with an existing key; persist the returned key in extension storage; show authoritative remaining credits and useful exhausted-balance messaging.
- [ ] **PAY-001C — Razorpay sandbox fulfilment:** create server-priced orders, verify payment server-side, grant credits idempotently, and add purchased credits to the same license.
- [ ] **PAY-001D — Website integration for purchases only:** keep website generation free; add a purchase/activation route only where needed to let users buy extension credits and receive their extension key. Website generations must not debit extension credits.
- [ ] **PAY-001E — Release checks:** test free website generation, extension trial, key reuse across devices, paid top-ups, owner access, attribution rules, payment duplicates/failures, and store packaging. Submit the updated extension for Chrome Web Store review; do not disrupt the current pending submission.

### Guardrails

- Razorpay is selected; live purchases remain disabled until sandbox and launch checks pass.
- Do not accept client-supplied prices, credit amounts, payment status, balance, trial status or owner status as authoritative.
- Do not put balance data inside or derive it from the license key. A key is a random revocable credential, not an encoded entitlement.
- Keep extension rate/burst limits independent of credits; paid credits do not promise unlimited request speed.
- Credit expiry/refund/service-shutdown policies still need to be decided before live sales.
- Keep generation telemetry privacy-preserving; do not log prompts, locations or generated posts as part of the financial ledger.
