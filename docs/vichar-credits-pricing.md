# Vichar — Credits, Trial and Pricing Plan

Updated: 2026-10-10

## Status

The following is the agreed implementation direction for launch planning. Runtime behaviour is not yet implemented. Pack prices remain the launch proposal and should be reviewed before public checkout is enabled.

## Proposed prepaid packs

| Pack | Price | Credits / generations | Price per credit |
|---|---:|---:|---:|
| Starter | ₹19 | 1,000 | ₹0.019 |
| Value | ₹49 | 5,000 | ₹0.0098 |
| Power | ₹99 | 15,000 | ₹0.0066 |

The working assumption is one credit per successful generation. Validate actual model usage (including retries), payment-provider fees, applicable taxes, refunds and operational overhead before publishing prices.

## One-time free allowance

- Grant 50 free generations once to a new eligible user/license identity; no recurring daily quota and no time-based expiry in the initial plan.
- After the free allowance is exhausted, generation stops until the user purchases credits.
- Keep the free allowance configurable server-side so it can later be raised to 100 without requiring an extension update.
- Enforce the one-time grant and balance server-side. Client storage must not be authoritative; define reasonable anti-abuse controls without adding device-counting restrictions.

## Credit and generation rules

1. The backend is the source of truth for trial eligibility, credit balance and deductions.
2. Deduct one credit per successful completed generation.
3. Failed provider/server requests must not silently consume a credit.
4. Define clear handling for retries, duplicate requests, timeouts and ambiguous outcomes. Avoid double deductions or free duplicate generations.
5. Verify payments on the server before crediting the balance.
6. Payment callbacks and fulfilment must be idempotent; a duplicated callback must not grant credits twice.
7. Burst/rate limits and abuse protection remain separate from credit entitlement. Paid credits do not automatically mean unlimited throughput.
8. Vichar remains human-controlled: generation creates a draft for the user to review/edit; no automatic publishing is introduced.

## Decisions still open

- **License model:** use one reusable random license key per customer. The server stores a hash of the key and owns the balance; do not encode the balance in the key. The same key may be used on multiple devices without a device limit. A payment/recovery contact flow remains to be specified.
- **Expiry/refunds:** decide credit expiry, refund eligibility, failed-payment handling and service-shutdown policy before accepting payment.
- **Legal/tax:** review applicable consumer, tax, privacy and payment obligations before launch.
- **Economics:** confirm official current model pricing and collect enough telemetry to measure completed-generation cost, including retries. Current telemetry records token usage per OpenAI response but does not yet correlate every response/retry to one completed generation.
- **Client experience:** design consistent trial, balance, purchase, low-credit and exhausted-credit states for both website and Chrome extension.

## Launch gates

- [ ] Server-side balance/ledger and transaction consistency designed.
- [ ] Razorpay checkout and verified webhook fulfilment implemented in sandbox.
- [ ] License-key creation, activation, recovery and revocation flow defined and tested.
- [ ] Permanent server-controlled owner entitlement implemented; it bypasses credit counting but not infrastructure safeguards.
- [ ] Paid license and owner outputs omit `Vichar by @vtrrk`; free outputs retain it.
- [ ] Server-verified, idempotent payment fulfilment implemented and tested.
- [ ] Failed-generation and retry accounting verified.
- [ ] Define one-time free-credit grant and proportionate anti-abuse policy.
- [ ] Pricing validated against model costs, retries, payment fees, taxes and operating costs.
- [ ] Expiry/refund/shutdown terms reviewed and published.
- [ ] Website and extension UX tested against authoritative backend entitlements.
- [ ] Payment sandbox end-to-end test completed.
- [ ] No live purchases enabled before review of the launch gates.

See [backlog.md](../backlog.md#vichar-pay-001--prepaid-credits-and-one-time-free-trial) for the implementation backlog item.
