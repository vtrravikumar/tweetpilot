# Vichar — Backlog

Updated: 2026-10-11

## Current status

Vichar V1 web experience is live at https://vtrrk.in/vichar/.

The Chrome extension v1.1.0 is implemented, packaged with the correct ZIP structure, CI-verified, and submitted to the Chrome Web Store. The current store submission is **pending review** with automatic publishing enabled after approval.

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
- [x] Razorpay payment-link creation, payment verification and idempotent credit fulfilment
- [x] Production payment configuration and live-checkout smoke test (checkout opened; no payment submitted)
- [x] Remove temporary test-license endpoint from production code and deployment

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
- [x] v1.1.0 release version set in manifest/package metadata
- [x] 10-generation free trial and prepaid credit-pack UI (₹19 / 1,000; ₹49 / 5,000; ₹99 / 15,000)



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

## VICHAR-SEC-001 — Chrome extension security and Enhanced Safe Browsing trust

- Priority: P1 (trust, security and launch readiness)
- Status: Planned
- Area: Chrome extension security, Chrome Web Store compliance, privacy
- Consumers: Chrome extension

### Goal

Investigate and address the Chrome Enhanced Safe Browsing message shown for Vichar — By VTRRK 1.1.0: “This extension is not trusted by Enhanced Safe Browsing.” The message does not by itself establish that the extension is malicious; determine whether it reflects limited publisher/extension reputation, a store/review state, a policy issue, or a concrete security concern. Do not promise that code changes alone will remove the warning; Chrome controls reputation and trust decisions.

### Scope and acceptance criteria

- [ ] Audit `extension/manifest.json` and request only the narrowest permissions and host access required for the documented X-only workflow.
- [ ] Review all bundled extension code and build output for remote executable code, unsafe dynamic execution, suspicious behaviour, unnecessary dependencies, and unexpected network destinations. API calls to the Vichar backend are allowed; do not download and execute JavaScript remotely.
- [ ] Review message passing, DOM interaction with X, storage, authentication/license handling, and API request/response validation for avoidable security risks.
- [ ] Verify that secrets and privileged credentials are not embedded in the extension package; treat all client-side values as public and enforce entitlements server-side.
- [ ] Verify HTTPS transport, data minimisation, and consistency between actual data flows, the privacy policy, and Chrome Web Store privacy/data-use disclosures.
- [ ] Check Chrome Web Store review/listing status and developer-policy notices; address any specific reviewer feedback or policy violations rather than guessing at the cause of the warning.
- [ ] Run extension tests, typecheck, production build, package inspection, and the available security/policy checks. Record findings and remediation in the PR.
- [ ] Keep the current 1.1.0 release artifact unchanged during the audit. Implement any required fixes on a focused branch, review them, and submit a new version only if justified by findings.
- [ ] After compliant publication, retest installation through the public Chrome Web Store and monitor whether the warning persists. Do not claim that the warning is resolved unless verified in Chrome; allow for reputation systems to take time.

### Guardrails

- Do not attempt to hide, suppress, or work around Chrome's warning, and do not instruct users to disable Safe Browsing.
- Do not claim that Vichar is “trusted by Chrome” or “safe” solely because automated tests pass or a code audit finds no issue.
- Distinguish concrete security/policy defects from reputation-related warnings; document uncertainty when Chrome does not expose a specific cause.

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
- [ ] Implement license-aware rate limiting: preserve sensible free-tier abuse protection while allowing paid and owner licenses to consume available credits at a higher pace; retain emergency infrastructure/abuse safeguards. Consumers: Chrome extension.
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
- Status: Implemented and live; Chrome extension v1.1.0 submitted for review
- Area: Backend/API, Chrome extension, Razorpay payments
- Consumers: Chrome extension. The website is a separate, free product surface.

### Product boundary

- **Vichar website (vtrrk.in/vichar): remains free.** Website generations must not consume extension trial or purchased credits. Keep website access/session handling separate from extension entitlement checks.
- **Vichar Chrome extension: monetised through a one-time free trial and prepaid credit packs.**
- The extension offers **Get 10 free generations** and **Activate with an existing key**. Free users receive a license automatically from the backend; no payment gateway or manual key entry is required for the free trial.
- The free allowance is 10 generations, enforced server-side. The separate daily/burst usage guard is not the same as the total license credit balance.
- After the 10 free generations are exhausted, extension generation stops until the user purchases credits.
- Live prepaid credit packs are ₹19 for 1,000 generations, ₹49 for 5,000, and ₹99 for 15,000. Razorpay hosted Payment Links are used; server-side verification and the `payment_link.paid` webhook provide idempotent credit fulfilment.
- A reusable random license key is shared across devices without device-count restrictions. Store only a key hash server-side; the backend owns the balance. Subsequent purchases add credits to the same license.
- Ravi has a permanent server-controlled owner entitlement for the extension: no credit counter or payment, while retaining basic infrastructure safeguards.
- Keep `Vichar by @vtrrk` attribution for free extension generations; omit it for valid paid-license and owner generations. The free website retains its existing website behaviour and must not inherit extension credit rules.
- One credit is deducted only for each successful completed extension generation. Failed generations must not silently consume credits. Balance must never become negative; backend balance is authoritative. Basic rate/burst protections remain separate from credits.
- No automatic publishing. Vichar continues to generate editable drafts for manual review and posting.

### Implementation sequence

- [x] **PAY-001A — Backend license and credit ledger:** hashed license credentials, authoritative balances, owner entitlement, atomic credit deductions and server-side checks.
- [x] **PAY-001B — Extension activation and balance UX:** free trial claim, activation with an existing key, balance display and exhausted-balance messaging.
- [x] **PAY-001C — Razorpay live payment fulfilment:** server-priced hosted Payment Links, server-side verification, signed webhook validation and idempotent credit fulfilment.
- [x] **PAY-001D — Product boundary:** website generation remains free and separate from extension credit accounting; no website changes are part of this release.
- [x] **PAY-001E — Release checks:** owner entitlement, temporary test-route removal, extension tests/typecheck/build, ZIP validation and Chrome Web Store submission.

### Release 1.1.0 — 2026-10-11

- Version: `1.1.0` in extension manifest, package metadata and lockfile.
- Chrome Web Store package `vichar-1.1.0.zip` uploaded for review; status pending at time of this update.
- Free trial: 10 generations.
- Packs: ₹19 / 1,000, ₹49 / 5,000, ₹99 / 15,000 generations.
- Payment handling: Razorpay hosted Payment Links, payment status verification, signed `payment_link.paid` webhook and idempotent fulfilment.
- Production temporary test-license endpoint removed; its `VICHAR_TEST_LICENSE_SECRET` secret was deleted.
- Owner license reactivated in the extension and displays unlimited owner access.
- Production burst setting was increased from 3 to 30 requests/minute through Cloudflare dashboard and smoke-tested successfully. `backend/wrangler.jsonc` is updated in this documentation change to match the deployed setting. Future changes should use license-aware rate limiting rather than assume one burst policy suits all entitlements.

### Guardrails

- Razorpay is selected; live purchases remain disabled until sandbox and launch checks pass.
- Do not accept client-supplied prices, credit amounts, payment status, balance, trial status or owner status as authoritative.
- Do not put balance data inside or derive it from the license key. A key is a random revocable credential, not an encoded entitlement.
- Keep extension rate/burst limits independent of credits. Current production burst setting is 30 requests/minute; the free credit allowance remains 10 total generations. Rate-limit policy is shared/configured separately today, not yet license-aware. Paid credits do not imply unlimited request speed.
- Credit expiry/refund/service-shutdown policies still need to be decided before live sales.
- Keep generation telemetry privacy-preserving; do not log prompts, locations or generated posts as part of the financial ledger.


## VICHAR-LANG-001 — Generate Vichar directly in the requested language

- Priority: P1
- Status: Done
- Area: Backend/API generation contract
- Consumers: Website and Chrome extension API compatibility

The existing `POST /v1/tweet/generate` optional `language` field now accepts valid BCP 47 language tags, canonicalizes tags such as `pt-br` to `pt-BR`, and instructs the model to compose directly in the requested language in one generation call. English remains the default when omitted. The change was merged in [PR #38](https://github.com/vtrravikumar/tweetpilot/pull/38); backend tests and type-check passed, and Ravi confirmed Cloudflare deployment. The website selector now includes additional languages. The Chrome extension remains unchanged until its separately tracked language-selector work is resumed.

### Deferred extension follow-up

#### VICHAR-LANG-EXT-001 — Add language selection to the Chrome extension

- Priority: P3
- Status: Parked
- Area: Chrome extension UI and API integration
- Consumers: Chrome extension
- Scheduling: Defer until the extension has a larger installed user base; review adoption/download numbers before scheduling. Agree on a practical activation threshold at that review rather than inventing one now.

Add language selection to the extension and send the selected BCP 47 `language` tag to the existing generation API. Include the languages supported by the Vichar website where practical, preserve English as the default for existing users, and keep the manual review/post workflow. The backend now accepts valid BCP 47 tags; this is an extension-only UI/integration change. Because implementation requires coding, regression testing, packaging, and a Chrome Web Store submission/review cycle, keep the extension unchanged until the adoption-based decision to resume this item is explicit.


## VICHAR-SOCIAL-001 — Explore multi-platform Vichar generation and assisted sharing

- Priority: P4
- Status: Parked
- Area: Product discovery / shared generation contract
- Consumers: Website (initial); Chrome extension impact to be assessed
- Website counterpart: [vtrravikumar/vtrrk.in — VICHAR-WEB-006](https://github.com/vtrravikumar/vtrrk.in/blob/main/backlog.md)

Explore making Vichar a thought-to-post companion for X, Facebook, and WhatsApp Status. Generate distinct platform-appropriate drafts from one original thought, with editable output and explicit user approval before sharing. Do not add autonomous posting.

- Keep language selection based on standard BCP 47 tags and reuse the existing generation endpoint where possible; assess whether a platform/style field is needed before changing the API contract.
- Facebook personal-profile posting is not assumed to be available through the official API. Assess official publishing for Facebook Pages separately, including Meta permissions and app review.
- WhatsApp Status should initially use assisted sharing: text copy and optional portrait image-card generation followed by user-controlled publishing. Avoid unofficial automation.
- Keep the website free and separate from extension licensing/credits. If extension support is later approved, document consumer scope and licensing implications.
- Verify platform policies, current APIs, media requirements, and mobile/desktop sharing behaviour before implementation.

This is a parked product idea, not approval to change the API or extension now. Coordinate implementation scope with the website item VICHAR-WEB-006.
