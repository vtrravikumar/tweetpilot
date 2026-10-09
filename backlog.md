# Vichar — Backlog

Updated: 2026-10-07

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

**Design direction agreed: 2026-10-09.** This is an approved direction for planning; implementation and release are not yet complete.

Vichar will treat the **content source** and **writing style** as separate dimensions:

- `useNews: true` explicitly requests a post grounded in recent news; `false` or an omitted field preserves ordinary topic-based generation.
- `style` remains a writing-tone attribute (for example, witty, thoughtful, professional). News is **not** a writing style and must not be included in random style selection.
- In News mode, retrieve relevant recent coverage using the topic and optional location, then write an original Vichar in the requested/randomly selected style.
- Return traceable source metadata (headline, publisher, article URL, and publication time when available) alongside the draft.
- If explicit News mode cannot find a suitable source, return a clear no-news/unavailable outcome rather than silently generating a generic post or inventing an event.
- Keep the existing editable-draft/manual-publishing workflow. No automatic publishing.

**Current implementation finding:** `backend/src/generation/news.ts` already contains a partial Google News RSS fetch/parser. The current trigger also fetches news whenever a location is present, even if News was not requested; the context is optional and source article URLs are not returned to clients. V4.0 work should correct these behaviours rather than duplicate the existing implementation.

**Consumers: Both** — the Vichar website and Chrome extension. Backend/API and extension work stays in this repository; website UI/integration stays in `vtrravikumar/vtrrk.in`.

#### Delivery stages

1. **VICHAR-010A — News retrieval contract and provider proof of concept**
   - Review the existing Google News RSS implementation for relevance, freshness, article URL extraction, malformed/empty responses, timeouts, and source attribution.
   - Validate the intended production usage and provider suitability before treating Google News RSS as a permanent dependency.
   - Define a typed news result and a distinct no-suitable-news outcome for explicit News mode.
   - Consumers: Backend/internal (proof of concept); no client contract change in this stage.
2. **VICHAR-010B — Backend News mode**
   - Validate optional boolean `useNews`; preserve existing behaviour when omitted/false.
   - Keep `style` solely for tone; remove `news` from style-specific behaviour and ensure location alone does not trigger news retrieval.
   - When `useNews: true`, retrieve news before generation and ground the draft in source facts.
   - Return source metadata in the API response only for News mode; preserve the existing `tweet` response field and existing consumers' compatibility.
   - Test success, no suitable results, stale/malformed feeds, timeouts, provider failures, character limits, attribution, and all existing non-News behaviours.
   - Consumers: Both.
3. **VICHAR-010C — Website API contract handoff**
   - Document the stable request/response contract and no-news/unavailable semantics for the website consumer.
   - Coordinate with website item [`vtrravikumar/vtrrk.in` — VICHAR-WEB-002](https://github.com/vtrravikumar/vtrrk.in/blob/main/backlog.md).
   - Do not implement website UI in this repository.
   - Consumers: Website.
4. **VICHAR-010D — Chrome extension integration**
   - Add the same explicit News option and show source metadata; keep existing writing-style selection independent.
   - Handle no-news/unavailable responses without changing the manual posting flow.
   - Consumers: Chrome extension.

**Provider note:** Google News RSS is the current proof-of-concept candidate, not a final production commitment. Confirm permitted use, reliability and source-link quality before finalising provider choice. Do not add a paid provider or extra infrastructure without an explicit cost/benefit decision.

**Release note:** Vichar V4.0 is a product milestone, not a claim that all stages must ship together. Do not mark V4.0 complete until backend behaviour and both client integrations are verified independently.
