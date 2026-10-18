# Vichar Cartoon — Implementation Plan

**Status:** Draft implementation in progress; route registered but disabled by default; not deployed  
**Parent design:** [Vichar Cartoon API Design](./VICHAR-CARTOON-API-DESIGN.md)  
**Initial provider:** OpenAI image generation  
**Owner testing policy:** Unlimited text remains separate; cartoon generation is subject to a controlled owner-only testing allowance  
**Production state:** Feature remains unavailable until explicitly reviewed and enabled

## 1. Decisions locked

- Start with OpenAI's image-generation API, then measure actual cost, latency, failure rate and character consistency.
- Keep the image provider behind a server-side interface so the provider can be changed without redesigning routes or credit policy.
- Owner text access remains unlimited under the existing owner entitlement. It does not grant unlimited image generation.
- During development/staging, owner cartoon tests use a separate, configurable allowance and explicit usage tracking.
- Paid-user image pricing and credit amounts are not set until real usage is measured.
- No deployment, production secret/variable update, database migration or client change is part of this planning milestone.

## 2. Provider integration approach

### Current implementation checkpoint

The first provider-adapter slice now exists on the draft implementation branch:

- `backend/src/cartoon/types.ts` defines a provider-neutral input/output contract.
- `backend/src/cartoon/openaiImageProvider.ts` uses the OpenAI Images API edit endpoint with a server-supplied reference image, one output, configurable size/quality, and a separate image API key.
- `backend/src/cartoon/errors.ts` normalizes failures without exposing upstream response bodies or secrets and labels whether the provider outcome is definitive or unknown.
- `backend/test/cartoon-image-provider.test.ts` covers request construction, missing credentials, provider errors, timeout classification, malformed image responses, PNG-header validation, and input validation.
- `backend/src/cartoon/generateCartoon.ts` implements a route-independent workflow for credit reservation, one-time provider claim, commit, definitive-failure settlement, and unknown outcomes.
- `backend/src/routes/generateCartoon.ts` registers `POST /v1/cartoon/generate` behind `VICHAR_CARTOON_ENABLED=true` and a positive `VICHAR_CARTOON_CREDIT_COST`; both are absent by default. It requires a valid license key and a separate image-credit balance, an idempotency key, and returns PNG bytes directly. Owner allowance and generated-image persistence/URL delivery are not implemented yet.
- `backend/test/cartoon-workflow.test.ts` tests that workflow with fake provider/ledger dependencies.
- `backend/src/cartoon/assets/ravi-editorial-v1.png` contains the approved 1536 × 1024 reference board; its SHA-256 is recorded in `docs/character-references/README.md`.
- `backend/wrangler.jsonc` marks PNG files under the cartoon asset directory as binary `Data` modules, and `backend/src/cartoon/characterReferenceAsset.ts` defines the canonical asset loader. The loader verifies the approved checksum and returns a defensive copy. **Packaging caveat:** the loader is not yet imported by the Worker route/entry point, so tree-shaking omits it from the current dry-run bundle. The current dry run therefore does not yet prove runtime asset availability; verify again when the cartoon route imports this loader.
- `backend/test/character-reference.test.ts` covers missing, invalid and mismatched assets; `backend/test/cartoon-reference-asset.test.ts` verifies the actual bundled file and checksum.
- The route is registered in the router but remains unavailable unless explicitly enabled with staging-only variables. No real provider request has been made.

These changes are on the draft branch only. Run the focused tests, full test suite, typecheck and a Wrangler dry-run locally before treating the bundle as verified. No deployment is part of this step.


Use the OpenAI Images API for the first experiment, with reference-image editing/conditioning as supported by the selected model and endpoint. Confirm the current API contract and model support during implementation rather than hard-coding an unverified model or assuming reference-image fidelity.

Suggested interface boundary:

- Input: thought text, canonical character reference/version, constrained style/prompt settings, requested output size/quality, request ID.
- Output: image bytes or provider response payload, MIME type, model identifier, usage metadata when available, duration, and a normalized error.
- The interface must not accept client-supplied arbitrary reference URLs.
- Keep API keys in Worker secrets; never return them or provider request details to the browser.
- Use deterministic fake providers in CI. Real provider calls are restricted to a small, explicitly approved staging experiment.

Prefer a single image per request initially. Avoid automatic retries that could create duplicate billable images. Any retry policy must be bounded and tied to idempotency.

## 3. OpenAI cost-measurement plan

Current public OpenAI documentation describes token-based pricing for GPT Image generation. The actual request cost depends on model, prompt tokens, reference-image input, output size, quality, and generated image tokens. Treat published sample costs as estimates, not a fixed per-image price. Check current pricing again immediately before the experiment and record the model/snapshot and settings used.

For every staging generation, record where available:

- model and model snapshot;
- size/aspect ratio and quality;
- reference asset version and input settings;
- text/image input and output token usage returned by the provider;
- measured API cost in USD, and a timestamped source/rate version used for the calculation;
- duration, success/failure category, and whether the output passed review;
- number of attempts for the request.

Do not record API credentials. Avoid retaining full thought text in operational logs; use a request ID and a short-lived test dataset. Keep a separate test ledger so these experiments cannot change customer credit balances.

### Initial experiment matrix

Use a small fixed test set of representative thoughts and a fixed canonical reference pack. Vary one factor at a time:

1. quality: low, medium, high where supported;
2. landscape/social-card output versus square output;
3. one reference image versus the approved multi-view pack, if the chosen API path supports the latter;
4. short, medium and long thought text;
5. repeated generations of the same prompts to measure consistency.

Start with the lowest-cost settings that can plausibly preserve the character. Increase quality only when the review set demonstrates a meaningful improvement. Do not use a large automated retry loop to improve visual results.

## 4. Character-quality evaluation

Before implementation, create and version a canonical reference pack. The approved working character identity includes:

- warm darker brown complexion and face proportions close to the approved baseline;
- short textured salt-and-pepper hair, approximately half silver and half dark;
- zero fade at the sides;
- rectangular glasses and salt-and-pepper stubble;
- prominent ears and a prominent diamond stud in the left ear;
- hand-drawn watercolor-and-ink editorial cartoon style;
- dry-witted, observant personality.

The final public character name is undecided and is not required for the API.

Review each image against a scorecard (1–5) for:
- face identity and likeness to the canonical reference;
- hair colour split and zero-fade haircut;
- glasses, stubble, ears and left-ear stud;
- expression/pose suitability to the thought;
- visual quality, legibility and composition;
- unwanted artefacts or identity drift.

A human review is required for the initial experiment. A passing score should not be defined solely by a model's self-evaluation. Retain rejected outputs only as long as necessary for evaluation, then apply the chosen deletion policy.

## 5. Owner-only controlled testing allowance

The current website owner path bypasses the extension's credit balance for text generation. Do not reuse or modify that balance for images.

Proposed owner cartoon testing policy:

- A dedicated, server-side owner image allowance, separate from text usage and paid-user balances.
- A configurable daily cap plus an overall experiment cap; both fail closed if configuration is missing or invalid.
- Allowance applies only to verified owner identity, never to anonymous web traffic or an ordinary extension license.
- Each attempt is recorded in a dedicated ledger with request ID, timestamp, status, model, character version and estimated/actual cost where available.
- A failed attempt should not be silently retried. Define whether provider errors count against the experimental cap before the first real run; keep financial cost and allowance accounting distinct.
- The feature remains disabled outside the explicitly enabled development/staging environment until the cap, access path and kill switch are tested.
- Add a global spend ceiling/alert outside the application if the provider account supports it; application caps alone cannot guarantee against every upstream billing issue.

The initial daily and total cap values are intentionally **TBD**. Choose conservative values after checking the provider account's available budget and the expected cost per attempt.

## 6. Credit ledger design — required before paid rollout

The current Durable Object stores a license balance and exposes single-credit consumption/refund operations for text generation. That is not sufficient for image reservations, variable image costs or safe request replay.

Design and test an explicit reservation lifecycle:

- `reserved`: expected image credits are held atomically; the provider has not yet been claimed for this operation.
- `processing`: a single caller has atomically claimed the right to invoke the provider. A duplicate request must not invoke it again.
- `unknown`: the provider outcome is ambiguous (for example, a timeout after sending the request). Keep credits held; do not retry the provider or automatically refund.
- `committed`: provider success is confirmed and the held credits remain charged. Reconciliation may commit an `unknown` operation if success is later confirmed.
- `released`: failure is confirmed and the held credits are returned. Generic release is limited to work still in `reserved`; a definitive provider failure after starting uses an explicit failure-settlement operation. Never release an `unknown` operation without reconciliation establishing that no chargeable generation occurred.

Requirements:

1. Each reservation has a unique operation/request ID and is idempotent.
2. Balance checks and reservation updates occur atomically inside the relevant Durable Object.
3. Concurrent requests cannot reserve more than the available image balance.
4. A retry with the same idempotency key cannot reserve or invoke the provider twice; a mismatched amount returns an explicit conflict result.
5. A timeout with unknown upstream outcome is not immediately treated as a guaranteed free failure. Reconcile outcome where possible; otherwise apply a documented conservative policy.
6. Text credits and image credits remain separate. The Durable Object now has an independent `image_balance`; legacy text balances and payment fulfilment are unchanged. A combined workflow preflights all required eligibility and credit conditions before the first billable provider call.
7. The owner test allowance is a separate namespace/ledger and cannot accidentally consume customer credits.
8. Every adjustment is auditable, and the balance cannot become negative.
9. Payment fulfilment remains unchanged and exactly-once.
10. Tests cover concurrent reservations, duplicate keys, one-time provider claims, release, commit, ambiguous outcomes, and DO storage errors.

Avoid a broad migration to an entirely new billing subsystem. Add the smallest schema/API extension that meets these invariants and remains compatible with existing licenses and payment records.

## 7. Proposed delivery phases

### Phase A — Plan and fixtures (completed checkpoint)

- Record provider choice and owner testing policy.
- Define the image-provider interface and usage metadata needed.
- Assemble the canonical reference pack and fixed evaluation prompts.
- Choose staging-only allowance values and an operational spend ceiling.
- No production changes.

### Phase B — Credit lifecycle tests

- Design the Durable Object reservation API and schema.
- Add deterministic tests before implementing the provider.
- Prove idempotency and concurrency behaviour with the Cloudflare Workers Vitest pool.
- Preserve all existing credit/payment tests and behaviour.

### Phase C — Provider adapter and staging experiment (adapter drafted; real experiment not approved)

- Implement the OpenAI image adapter behind the interface.
- Use only server-side credentials.
- Keep the route/feature disabled by default.
- Run a small number of explicitly approved staging calls with the owner allowance.
- Record usage and review images against the scorecard.

### Phase D — API and client integration

- Choose the public endpoint version after reviewing the existing route contracts. Additive, backward-compatible capabilities may remain under `/v1/`; breaking request/response, auth, entitlement or error-contract changes require a new versioned route (for example `/v2/`). Document the decision before implementing the route.
- Add the dedicated cartoon route and opt-in combined flow only after provider and credit lifecycle tests pass.
- Preserve the existing text-only response contract.
- Enforce owner test allowance separately from paid entitlement.
- Add clear partial-success responses when image generation fails.
- Do not yet expose the feature to public clients by default.

### Phase E — Commercial decision and release gate

- Calculate realistic average and high-percentile costs, including reference-image input.
- Set image-credit cost and paid eligibility policy.
- Test abuse limits, idempotency, data retention, deletion, timeouts and rollback.
- Enable public access only after a separate review/approval.

## 8. Release gates

- [x] Canonical reference pack is approved and versioned; binary is committed on the draft branch and checksum is documented.
- [x] The registered cartoon route imports the canonical loader; a Worker-runtime route test reaches the provider workflow only after the canonical PNG passes its checksum validation.
- [ ] Confirm the generated Worker bundle includes the approved PNG and rerun the Wrangler dry run after local tests.
- [ ] OpenAI model/API path is verified against current official documentation.
- [ ] Cost measurement includes prompt and reference-image input plus generated image output.
- [ ] Owner test allowance is separate from text and customer credit balances.
- [ ] Staging-only feature gate and kill switch are tested.
- [ ] Durable Object reservation/commit/release operations are atomic and idempotent, including the new independent image balance (run the full local suite before marking complete).
- [ ] Concurrent requests cannot overspend balances or allowances.
- [ ] Ambiguous provider timeouts have a documented reconciliation policy.
- [ ] CI tests use fakes and make no real provider calls.
- [ ] Character consistency is reviewed by a human against the scorecard.
- [ ] Image storage, URL expiry, privacy and deletion policy are defined.
- [ ] Paid credit price is based on measured cost plus an explicit margin/contingency.
- [ ] Existing text-only website and extension flows pass regression tests.
- [ ] No production deployment/config change occurs without a separate approval.

## 9. Official references to re-check during implementation

- OpenAI image generation guide: https://developers.openai.com/api/docs/guides/image-generation/index.html
- OpenAI API pricing: https://developers.openai.com/api/docs/pricing

These URLs are provided for implementation review; current model support, input/reference-image handling, usage metadata and pricing must be re-verified before any real provider calls.
