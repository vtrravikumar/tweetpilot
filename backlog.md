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

### Current-information / news generation scope note

`VICHAR-010` is the existing parked proposal for server-side current-information/web-search generation. It is **not implemented or approved for implementation by this backlog entry**. Google News is not currently specified as a selected provider. Before work begins, define the source/provider strategy and mark the intended consumers explicitly (`Website`, `Chrome extension`, or `Both`); then cross-reference the corresponding client integration item in `vtrravikumar/vtrrk.in` if the website is in scope.
