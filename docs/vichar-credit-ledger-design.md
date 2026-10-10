# Vichar — Credit Ledger and Identity Design

Updated: 2026-10-10

## Purpose and status

This document is the design step following the agreed provisional pricing and trial plan. It is a proposal for review, not an implementation decision. No payment provider, identity mechanism, database schema, or production behaviour is changed by this document.

Existing state: the Worker uses a Durable Object for per-installation rate-limit counters. The extension creates an opaque UUID in Chrome local storage and sends it as a bearer usage identifier. The website currently obtains a short-lived session token from `POST /v1/web/session`. These mechanisms protect current usage paths but are not, by themselves, a recoverable cross-device customer account or a prepaid-credit ledger.

## Product invariants

1. Server-side state is authoritative for trial eligibility, trial use, credit balance and payment status.
2. One credit is consumed per successful completed generation.
3. A failed generation must not silently consume a credit.
4. Payment is verified server-side before credits are granted.
5. Duplicate payment events or request retries must not grant or consume credits twice.
6. Rate/burst limits remain independent of paid balance.
7. Generated prompts, topics, locations and tweet text are not required for a financial ledger and must not be stored in it.
8. The extension and website must use the same account entitlement and balance when a user is signed in.
9. Never accept a client-supplied price, credit amount, payment status, balance or trial status as authoritative.

## Identity options

### Option A — Per-installation identifier only

**Advantages:** lowest friction; reuses the extension's existing opaque identifier; no email/account system.

**Risks:** reinstalling or switching browsers/devices can create a new identity; purchased credits are difficult to recover or share across web and extension; trial abuse is relatively easy; payment support and refunds are harder to associate with a customer.

**Assessment:** unsuitable as the sole owner of paid balances. It can remain a rate-limit/abuse signal, but should not be the canonical paid account.

### Option B — Email-based account with passwordless sign-in

A user verifies ownership of an email address through a magic link or one-time code. The backend owns the account ID and entitlement ledger. Website and extension use short-lived access sessions, with refresh/re-authentication designed carefully for each client.

**Advantages:** supports account recovery, cross-device access, web/extension balance sharing, and clearer purchase support without collecting passwords.

**Costs/risks:** adds authentication and email-delivery dependencies, account lifecycle and privacy-policy work, abuse controls, and more UX than the current anonymous flow. Email is personal data and must be handled accordingly.

### Option C — Keep anonymous trial, require account only to purchase

Users may use the 20-generation trial anonymously, then create/verify an account to purchase credits. Paid credits belong to the verified account.

**Advantages:** keeps first-use friction low while making paid balances recoverable and portable.

**Risks:** trial identity is still easier to reset/abuse; account creation at the paywall adds conversion friction; merging anonymous trial state into an account needs explicit rules.

## Recommendation for discussion

Prefer **Option C as the initial product experience**, with an account-bound ledger for all purchased credits. Keep the existing per-installation identifier only as a rate-limit and abuse signal, not as the owner of purchased funds. Require a verified account before checkout, and do not automatically transfer or merge anonymous trial counters across identities without a defined policy.

This is a recommendation only. Ravi must approve the identity/trial approach before implementation.

## Proposed logical ledger model

Use an append-only ledger as the auditable source of truth; a cached balance may be added for performance but must be updated transactionally with ledger entries.

- **accounts**: internal account ID, verified email reference/status, created/updated timestamps, account state.
- **entitlements**: account ID, entitlement type (`trial` or `credits`), status, start/expiry timestamps, source reference.
- **credit_ledger**: immutable entry ID, account ID, signed credit delta, reason/type, unique idempotency key, related generation/payment/refund reference, timestamp. Do not store prompt or generated text.
- **payments**: internal payment ID, account ID, provider, provider order/payment identifiers, amount/currency, status, pack SKU, granted credits, timestamps. Store only the provider identifiers and minimum data needed for reconciliation.
- **generation_operations**: opaque operation ID/idempotency key, account ID, status, reserved/settled credit state, provider-attempt count and timestamps. Do not store tweet text or prompt.
- **installation_links** (optional): account ID plus a hashed/opaque installation identifier for abuse/rate-limit signals; no raw client identifier needed if a stable hash suffices.

Exact physical storage is open. Durable Objects provide strong per-object consistency but a single account-scoped object is not automatically a global relational ledger. Choose a storage design only after evaluating transaction and concurrency guarantees, expected scale, backups, retention and operational complexity. Do not put paid balances into the current daily/minute counter table without a deliberate migration design.

## Generation accounting flow

1. Authenticate the account and validate the request.
2. Enforce independent burst/rate limits.
3. Create or retrieve an idempotent generation operation.
4. Check trial eligibility/remaining allowance or available purchased credits on the server.
5. Reserve one unit atomically before making the billable provider call, so concurrent requests cannot overspend. The reservation is not yet a final deduction.
6. Call the model. Record each provider attempt's token usage for cost analysis, associated with the opaque operation ID where possible; never log prompt/output or credentials.
7. On a valid completed generation, atomically settle the reservation as one consumed credit (or one trial use) and mark the operation successful.
8. On a definitive failure before successful generation, release the reservation. For ambiguous timeouts where the provider may have completed, define a bounded reconciliation policy; do not blindly retry and double-charge.
9. Return the generated draft and authoritative balance/entitlement metadata.

A successful API response should carry a stable operation ID so clients can safely retry a lost response without creating a second charge or second model call when the result is recoverable. Define how long idempotency records and any response result metadata are retained. Avoid persisting generated content unless a separate product requirement explicitly approves it.

## Payment fulfilment flow

1. Client requests checkout for a server-defined pack SKU; the client cannot set amount or credit quantity.
2. Backend creates an order using the selected provider and records the internal order and expected amount/currency/SKU.
3. Provider confirmation/webhook is verified server-side using the provider's documented signature/verification method.
4. Backend checks provider payment status and expected order details; never trust the browser redirect alone.
5. In one atomic/idempotent operation, mark the payment fulfilled and append exactly one positive ledger entry for the configured pack.
6. Duplicate webhook delivery returns a safe success/no-op; it must not add credits again.
7. Reconciliation checks provider transactions against internal payment records and ledger grants.
8. Refunds/chargebacks create explicit compensating ledger entries and follow the policy approved before launch. Never silently edit/delete historical ledger entries.

## Decisions required before implementation

- [ ] Approve identity approach (A, B or C; recommended C).
- [ ] Choose email verification/authentication provider and session lifecycle if an account is required.
- [ ] Select payment provider after comparing fees, webhook verification, refunds, settlement, supported currencies and operational requirements.
- [ ] Choose the physical ledger store and confirm atomicity/concurrency behaviour.
- [ ] Define idempotency keys, reservation timeout/recovery, ambiguous provider-timeout handling and retention.
- [ ] Decide trial reset/abuse policy and whether anonymous trial use is allowed.
- [ ] Decide credit expiry, refund, chargeback and service-shutdown policies.
- [ ] Review privacy policy, data retention/deletion and applicable tax/consumer obligations.
- [ ] Add monitoring and support/reconciliation procedures.

## Suggested implementation sequence after approval

1. Identity/account session foundation and migration-safe contracts.
2. Ledger schema and atomic account-level entitlement operations, with tests.
3. Idempotent generation reservation/settlement/refund operations.
4. Payment provider integration in sandbox, including duplicate and out-of-order webhook tests.
5. Website and extension account/balance/purchase UX.
6. End-to-end sandbox validation and security review.
7. Enable live payments only after launch gates are signed off.

See [backlog.md](../backlog.md#vichar-pay-001--prepaid-credits-and-one-time-free-trial) for the parent monetisation item.
