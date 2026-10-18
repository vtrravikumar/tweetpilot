# Vichar Cartoon Generation — Proposed API and Product Design

**Status:** Design proposal only — not implemented  
**Scope:** TweetPilot/Vichar backend and future web/extension clients

This document records the agreed direction before implementation. Proposed routes and fields below do not exist in production merely because they are documented here.

## 1. Agreed product decisions

- Before generation, users explicitly choose **Text only** or **Text + cartoon**.
- Text-only remains the default. Existing clients that omit the new option retain current behaviour.
- Cartoon generation is a premium/paid capability. The server checks entitlement and sufficient credits before any billable work.
- Text and image usage are accounted for separately. Cartoon generation costs more credits than text-only; exact amounts remain **TBD** until provider costs and quality are measured.
- Cartoon generation accepts the actual thought text, including user-edited text, rather than requiring an internal thought ID.
- The server chooses the approved, versioned character reference; clients cannot replace it with arbitrary URLs.
- If text succeeds but image generation fails, preserve the text result, report partial success and release/refund the reserved image credits under the agreed ledger policy.
- Vichar remains a drafting assistant and does not automatically publish to X.

## 2. Proposed user flow

1. User enters context and selects Text only or Text + cartoon.
2. If cartoon is selected, check entitlement, credits, rate limits and idempotency before billable work.
3. If ineligible or underfunded, stop before calling either generation provider.
4. Generate the thought using the existing text-generation path.
5. For text-only, return the thought and never call the image provider.
6. For text + cartoon, pass the generated thought text to the cartoon-generation path.
7. Return text and image outcomes independently. If image generation fails, preserve the successful text.
8. User reviews/edits the text and decides whether to publish through X's native composer.

## 3. Proposed API contracts

These are proposals, not current production contracts. Preserve existing authentication, origin checks, response conventions and error envelopes.

### 3.1 Existing thought endpoint — additive opt-in

**POST /v1/tweet/generate**

Proposed request addition:

    {
      "topic": "Life & Observations",
      "location": "Chennai",
      "style": "witty",
      "maxLength": 140,
      "includeCartoon": false
    }

Rules:

- includeCartoon is optional and defaults to false for backward compatibility.
- false follows today's text path and does not reserve or consume image credits.
- true requests the combined workflow and requires entitlement and adequate credits to be validated before billable generation.
- Existing text-only response behaviour must not change unexpectedly.
- Combined responses represent text and image outcomes independently.

Illustrative combined response (values and URL are placeholders):

    {
      "thought": {
        "text": "A sample thought for illustration."
      },
      "cartoon": {
        "status": "succeeded",
        "imageUrl": "https://example.invalid/generated-image",
        "characterVersion": "v1"
      },
      "usage": {
        "textCredits": 1,
        "imageCredits": 5
      }
    }

Suggested cartoon states: not_requested, succeeded, failed. Never substitute placeholder artwork or treat a failed image as a failed text generation.

### 3.2 Dedicated cartoon endpoint

**POST /v1/cartoon/generate**

This route makes cartoon generation reusable for user-edited thought text and future clients.

Illustrative request:

    {
      "thoughtText": "The user's final, edited thought text.",
      "style": "editorial-watercolor"
    }

Illustrative response:

    {
      "status": "succeeded",
      "imageUrl": "https://example.invalid/generated-image",
      "characterVersion": "v1"
    }

Rules:

- Require the appropriate server-side identity/authentication context.
- Require explicit cartoon entitlement, sufficient image credits, rate-limit checks and idempotency protection.
- Accept the thought text itself; do not require a thought ID.
- Validate and bound text length and style values.
- Do not let clients supply arbitrary reference-image URLs or override the canonical character.
- Keep provider credentials and provider-specific details server-side.
- Direct calls must not bypass entitlement or credit checks.

## 4. Entitlement and credit rules

1. **Server is authoritative.** Never trust a client-supplied plan, balance, price or entitlement flag.
2. **Premium gate first.** Ineligible cartoon requests are rejected before either provider is called.
3. **Separate usage buckets.** Track text and image generation separately, even when invoked through one combined request.
4. **Reserve before spending.** Reserve expected image credits atomically before image generation. For a combined request, validate and reserve the full required workflow before the first billable provider call.
5. **Concurrency-safe accounting.** Concurrent requests must not overspend the same balance.
6. **Failure handling.** If text fails, no image should be generated; release reservations according to ledger rules. If text succeeds and image fails, preserve text and release/refund the image reservation under a documented, auditable policy.
7. **Idempotency.** Client retries must not double-charge or unintentionally generate duplicate images. Return the original result where safe.
8. **Cost visibility.** Record provider/model, operation, request ID, character version, outcome, latency and ledger events without logging secrets or unnecessarily retaining prompt text.
9. **Owner access must be explicit.** Website owner entitlement and extension license paths are distinct. Cartoon eligibility for each must be defined in server-side policy; unlimited text generation must not automatically imply cartoon entitlement.
10. **No silent fallback.** Return clear partial success when image generation fails.

Exact credit prices, refund/retry policy, retention period and owner/website eligibility remain implementation decisions.

## 5. Character identity and reference assets

The character has an approved working baseline, but a canonical reference pack still needs to be assembled and versioned.

### Identity traits to preserve

- Warm, darker brown complexion.
- Face proportions close to the approved baseline, especially lips, chin and jawline; avoid a double chin.
- Short textured salt-and-pepper hair, approximately half white/silver and half dark.
- **Zero fade at the sides**; do not introduce a fade.
- Rectangular glasses and salt-and-pepper stubble.
- Prominent ears and a prominent diamond stud in the **left ear**.
- Colourful hand-drawn watercolor and ink editorial-cartoon style.
- Personality: silent observer with dry wit, noticing contradictions without preaching.

Clothing, pose, expression, background and props may vary. Core identity traits should remain consistent. The public character name is not finalized and must not be hard-coded into the API yet.

### Asset and version requirements

- Create canonical front, three-quarter and side views, plus neutral, sceptical and dry-smile expressions.
- Store canonical references in controlled backend storage (for example, a private object bucket); choose the actual storage location during implementation.
- Assign immutable versions such as v1. Record the version used for each generated image.
- The client cannot substitute or modify the canonical reference.
- Keep reference assets separate from publicly served generated images. Never expose private storage credentials or internal object paths.
- Decide generated-image storage, expiry, access control and deletion policy before launch.
- Build a consistency evaluation set and review quality before enabling the feature.

## 6. Errors and partial success

Use existing Vichar error-envelope conventions when implementing. The codes below are conceptual suggestions, not existing live errors.

| Condition | Expected behaviour |
|---|---|
| Cartoon feature not entitled | Reject before billable generation; explain premium access is required |
| Insufficient combined-workflow credits | Reject before calling either provider |
| Text provider fails | Return text-generation failure and release reservations |
| Image provider fails after text succeeds | Return successful text with cartoon status failed; release/refund image reservation per policy |
| Invalid or oversized thought text | Reject before image provider call |
| Rate limit exceeded | Use established rate-limit response |
| Duplicate idempotency key | Avoid duplicate generation/charges; return original result or safe conflict |
| Character reference unavailable | Fail closed for image generation; preserve text if already generated |

Never include API keys, license keys, signed internal storage credentials or provider stack traces in public errors.

## 7. Security and privacy

- Keep OpenAI and image-provider credentials in Worker-side secrets.
- Reuse current authentication, CORS/origin checks, entitlement checks and rate limits; do not weaken website or extension paths.
- Enforce input size limits, timeouts, provider-response validation and bounded retries.
- Do not accept arbitrary remote reference URLs from clients.
- Use short-lived or access-controlled image URLs as appropriate to the final storage design.
- Minimize sensitive text in logs. Decide whether thought text and images are retained, for how long, and how deletion requests are handled.
- Automated tests must not call real providers. Inject deterministic fakes and test success, timeout, malformed output, provider errors, retries and partial-success accounting.

## 8. Implementation sequence — not started

1. **Contract review:** reconcile this proposal with current Worker routes, auth, error envelope and Durable Object ledger.
2. **Pricing decision:** measure provider cost/quality; define image-credit amount, reservation, refund policy and rate limits.
3. **Reference pack:** assemble and approve canonical assets; choose private storage and versioning.
4. **Backend design/tests:** define provider interface, entitlement rules, atomic reservation, idempotency and partial-success response.
5. **Feature-gated implementation:** preserve default text-only behaviour; no production rollout yet.
6. **Client integration:** add the explicit choice and clear credit/upgrade messaging only after the backend contract is stable.
7. **Quality and abuse testing:** fake providers in CI, then a controlled staging test with a small number of real image generations.
8. **Release review:** confirm cost ceilings, observability, privacy, rollback and user-facing terms before enabling paid access.

## 9. Acceptance checklist

- [ ] Existing text-only requests work unchanged.
- [ ] Omitted includeCartoon behaves as false.
- [ ] Ineligible and underfunded requests are rejected before billable generation.
- [ ] Text-only requests never call the image provider or incur image credits.
- [ ] Combined requests reserve credits safely and atomically.
- [ ] Concurrent requests cannot overspend a balance.
- [ ] Image failure preserves successful text and correctly releases/refunds image credits.
- [ ] Retries cannot double-charge or unintentionally duplicate images.
- [ ] Server always chooses the canonical, versioned character reference.
- [ ] Result records character version and credit-ledger outcome.
- [ ] No provider credentials or private reference assets are exposed to clients.
- [ ] Automated tests do not call real generation providers.
- [ ] Feature remains disabled in production until reviewed and explicitly enabled.

## 10. Out of scope

- Automatic publishing to X.
- Arbitrary user-uploaded characters or reference URLs.
- Final character naming/branding.
- A separate microservice solely for cartoons before the existing Worker architecture has been evaluated.
- Changing current website owner access or extension credit semantics incidentally as part of this feature.
