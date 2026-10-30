# Vichar public access and abuse controls

Vichar remains publicly accessible without accounts. The Worker verifies a Cloudflare Turnstile token before issuing a short-lived web session, then applies atomic per-IP and global generation budgets in the `global-vichar-stats` Durable Object. Browser Origin is used only for CORS/origin policy; it is not authentication. Request bodies are size-bounded, session and generation attempts are rate-limited, and client errors are sanitized.

## Operator configuration

The repository defaults are intentionally finite and are configured in `backend/wrangler.jsonc`:

| Worker variable | Default | Meaning |
|---|---:|---|
| `VICHAR_WEB_IP_DAILY_LIMIT` | `20` | Website generation reservations per client IP each UTC day |
| `VICHAR_WEB_IP_BURST_PER_MINUTE` | `3` | Website generation reservations per IP per minute |
| `VICHAR_WEB_GLOBAL_DAILY_LIMIT` | `1000` | Hard website generation reservation ceiling per UTC day across all IPs |
| `VICHAR_WEB_SESSION_PER_MINUTE` | `10` | Session issuance attempts per IP per minute |
| `VICHAR_WEB_SESSION_GLOBAL_PER_MINUTE` | `1000` | Siteverify/session attempts across all IPs per minute |
| `VICHAR_FREE_TRIAL_GLOBAL_DAILY_LIMIT` | `500` | Free extension trials issued across all IPs each UTC day |
| `VICHAR_FREE_TRIAL_GLOBAL_BURST_PER_MINUTE` | `30` | Free extension trials issued globally per minute |

Adjust these values in the Worker environment configuration and deploy through the normal reviewed release process. The generation counters reserve one unit before invoking the generator, so provider failures still count toward the limit. This conservative behavior prevents retries from exceeding the application budget. If the Durable Object is unavailable or the client IP cannot be obtained, public web generation and session issuance fail closed.

The existing `VICHAR_BURST_PER_MINUTE` continues to apply to owner/extension burst controls; extension license credits and authentication behavior are unchanged.

## Cloudflare Turnstile setup

1. Create a Turnstile widget in Managed mode. Allow `vtrrk.in` and the specific Cloudflare Pages preview hostnames that should use website access.
2. The website requests a token with action `vichar_web_session`; the Worker requires that exact action in the Siteverify response.
3. Set the returned **site key** as the public frontend build variable `PUBLIC_TURNSTILE_SITE_KEY`. It is intentionally public and must only be used by the browser widget.
4. Store the **secret key** as a Worker secret, never as a `vars` entry or frontend variable:

   ```sh
   cd backend
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

5. The website renders the Turnstile widget, obtains its response token, and sends JSON `{ "turnstileToken": "..." }` to `POST /v1/web/session`. It handles verification errors by requesting a fresh token. The Worker verifies the token with Siteverify, requires the returned hostname to match the request origin hostname and action to match `vichar_web_session`, and rejects token reuse.
6. Configure the existing Worker secret `VICHAR_WEB_SECRET` separately. Do not put either Worker secret in browser code, source control, logs, or API responses.

## Production rollout record

As of 2026-10-30, website PR [#32](https://github.com/vtrravikumar/vtrrk.in/pull/32) and API PR [#44](https://github.com/vtrravikumar/tweetpilot/pull/44) are merged. The Pages build variable `PUBLIC_TURNSTILE_SITE_KEY` is set for Production and Preview; the Worker secret `TURNSTILE_SECRET_KEY` is configured as a secret. The website deployed before the API began enforcing Turnstile. Production verification observed the Turnstile human-check UI, a widget analytics event, and successful Vichar generation. The widget hostname allowlist includes production `vtrrk.in`; add the exact approved Pages preview hostnames before testing previews. Secret and site-key values are not recorded here.

Pre-merge CI passed: backend typecheck and 353 tests; website 29 tests and production build.

The backend package release is `0.1.2`. API contract paths remain unchanged; this security release does not introduce a new API contract version.

## Privacy and operations

The Worker hashes the Cloudflare-provided client IP before using it as a Durable Object key. It does not include the IP in Siteverify requests or log session tokens, Turnstile tokens, prompt text, or secret values. Website IP usage rows are removed after their UTC day; Turnstile hashes are removed after their five-minute validity window; free-trial IP hashes are removed after their UTC day. Review Cloudflare account-level observability and retention settings separately.
