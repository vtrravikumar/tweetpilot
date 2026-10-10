# Vichar — Credits, Trial and Pricing Plan

Updated: 2026-10-10

## Status

The following is the agreed provisional product direction for launch planning. It is not yet implemented and the prices must not be treated as a final public commitment until cost and payment economics are validated.

## Proposed prepaid packs

| Pack | Price | Credits / generations | Price per credit |
|---|---:|---:|---:|
| Starter | ₹19 | 1,000 | ₹0.019 |
| Value | ₹49 | 5,000 | ₹0.0098 |
| Power | ₹99 | 15,000 | ₹0.0066 |

The working assumption is one credit per successful generation. Validate actual model usage (including retries), payment-provider fees, applicable taxes, refunds and operational overhead before publishing prices.

## One-time free trial

- Duration: 14 days.
- Allowance: up to 20 successful generations.
- Trial is one-time per eligible user/account, subject to the identity and anti-abuse approach still to be selected.
- When the trial expires or the allowance is exhausted, generation stops until credits are purchased.
- Trial eligibility and allowance must be enforced server-side; client storage must not be authoritative.

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

- **Identity and trial abuse:** decide between account-based identity and a lower-friction installation identity, considering recovery, cross-device balances, privacy and abuse.
- **Payment provider:** not selected. Razorpay can be evaluated but is not approved by this document.
- **Expiry/refunds:** decide credit expiry, refund eligibility, failed-payment handling and service-shutdown policy before accepting payment.
- **Legal/tax:** review applicable consumer, tax, privacy and payment obligations before launch.
- **Economics:** confirm official current model pricing and collect enough telemetry to measure completed-generation cost, including retries. Current telemetry records token usage per OpenAI response but does not yet correlate every response/retry to one completed generation.
- **Client experience:** design consistent trial, balance, purchase, low-credit and exhausted-credit states for both website and Chrome extension.

## Launch gates

- [ ] Server-side balance/ledger and transaction consistency designed.
- [ ] Server-verified, idempotent payment fulfilment implemented and tested.
- [ ] Failed-generation and retry accounting verified.
- [ ] Trial identity and anti-abuse policy decided.
- [ ] Pricing validated against model costs, retries, payment fees, taxes and operating costs.
- [ ] Expiry/refund/shutdown terms reviewed and published.
- [ ] Website and extension UX tested against authoritative backend entitlements.
- [ ] Payment sandbox end-to-end test completed.
- [ ] No live purchases enabled before review of the launch gates.

See [backlog.md](../backlog.md#vichar-pay-001--prepaid-credits-and-one-time-free-trial) for the implementation backlog item.
