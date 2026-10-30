# Vichar API Versioning and Compatibility

## Decision

Vichar uses one Cloudflare Worker and one shared generation engine. Website and Chrome extension clients may use different API contract versions so that new behaviour can be validated on the website before being adopted by the extension.

API versions are contract versions, not deployment or product release numbers. Backend fixes can be deployed without incrementing an API version when the contract remains compatible.

## Current backend contracts

The backend router currently registers:

- `POST /v1/tweet/generate` — stable/default generation response used by the Chrome extension.
- `POST /v2/tweet/generate` — generation route with the selected style included in the response.
- `POST /v1/web/session` — website session issuance; requires a valid one-use Turnstile response.

The branded API namespace `/vichar/*` maps to the same route handlers. The extension calls `https://api.vtrrk.in/vichar/v1/tweet/generate`; the website calls `/vichar/v1/web/session` and `/vichar/v2/tweet/generate`.

The backend package version is `0.1.2`. It identifies a backend release and is separate from API contract versions. Production rollout was verified on 2026-10-30; see [Vichar abuse controls](security/vichar-abuse-controls.md).

## Rollout policy

1. Keep the extension on the stable contract until a feature has been validated.
2. Use a newer API contract for website-first experiments when the contract change warrants it.
3. Promote features selectively. The extension can migrate to the newer contract or receive a compatible backport; do not force a version migration just because a feature shipped on the web.
4. Keep the old route available while supported clients depend on it.
5. Share generation, security, telemetry, and infrastructure between API versions. Apply entitlement and accounting rules explicitly by client access path; website generations must not debit extension credits.
6. Add contract tests for each supported route and verify both clients before retiring a version.

## Payment and entitlement compatibility

The credit ledger and payment verification are backend services shared by the API versions. The website remains free and does not consume extension trial or purchased credits. The extension uses its free grant or paid license balance. Owner access must be verified server-side and must never rely on an owner secret embedded in public website JavaScript or extension assets.

Razorpay fulfilment must be server-verified and idempotent. No live payment flow or production deployment should be enabled until the ledger, payment verification, and client compatibility tests pass.
