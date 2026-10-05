# TweetPilot — M0 Architecture & Development Plan

## 1. Purpose

TweetPilot is a Chrome extension, branded TweetPilot — By VTRRK, that helps generate personalised tweet suggestions inside the X.com posting experience.

The user remains in control of publishing. TweetPilot does not automatically click X's Post button or publish through the X API in the initial scope.

## 2. Development order

1. M0 — Architecture & infrastructure decisions
2. M2 — AI backend
3. M1 — Chrome extension
4. M3 — Hardening, integration and polish

M0 is a short architecture/setup gate, not a large implementation phase.

## 3. M0 decisions

### Backend
- Runtime/platform: Cloudflare Workers
- Language: TypeScript
- Deployment: Wrangler
- Existing user Cloudflare account will be reused.
- No dedicated server, VM, Docker or Kubernetes.
- No database initially.

### AI
- Initial provider: OpenAI API
- AI provider is abstracted behind a TweetGenerator interface.
- Future providers can be added without changing the extension contract.
- ChatGPT subscription and API billing are treated as separate concerns.

### Security
- OpenAI API key must never be bundled into the Chrome extension.
- API credentials will be stored as Cloudflare Worker secrets.
- Secrets will be managed through Wrangler and/or the Cloudflare dashboard; the Claude Cloudflare connector does not currently expose secret-management tools.
- X credentials are not collected.
- X API is not required for the initial product.
- The backend will validate requests and eventually apply rate limiting/abuse protection.

### Extension
- TypeScript
- Vite
- Chrome Manifest V3
- Vitest
- The extension will call the backend over HTTPS.
- The extension will not automatically publish a tweet.

## 4. Initial API contract

The backend will expose a versioned endpoint:

    POST /v1/tweet/generate

Initial request shape:

    {
      "topic": "Photography",
      "location": "Chennai",
      "style": "thoughtful",
      "maxLength": 140
    }

Initial response shape:

    {
      "tweet": "..."
    }

The contract may evolve during M2, but M1 should depend on the API contract rather than on OpenAI-specific implementation details.

## 5. AI abstraction

The backend should use an abstraction similar to:

    TweetGenerator
        |
        +-- OpenAIProvider

Future providers may include other AI services without requiring changes to the extension.

## 6. Tweet personality

Generation should be personalised around the configured user profile and interests.

Initial interests:
- Technology & AI
- Photography
- Royal Enfield & riding
- Travel & exploration
- Life & observations

Initial style:
- Conversational
- Thoughtful
- Occasionally witty
- Avoid generic motivational language
- Minimal hashtags
- Avoid repetitive subjects
- Should not sound obviously AI-generated

Location is configurable context, not precise location tracking.

## 7. Cloudflare/Claude tooling boundary

The official Cloudflare Developer Platform connector is connected to Claude Desktop and has been verified read-only.

Current observed capabilities include:
- List and inspect Workers
- Read Worker source/details
- List/manage KV namespaces
- List/query/create/delete D1 databases
- Cloudflare documentation search

Current observed limitations include:
- No Worker deployment/update tool
- No Worker deletion tool
- No secret-management tool
- No direct management of all Worker bindings/resources
- GitHub repository access is separate from the Cloudflare connector
- R2 is not enabled in the current Cloudflare account

Therefore:
- Claude Desktop may assist with coding, review and Cloudflare inspection.
- Worker deployment will use Wrangler or a GitHub-connected Cloudflare build/deployment path.
- Secrets will be configured through Wrangler or the Cloudflare dashboard.
- D1, KV and R2 are not part of the initial TweetPilot backend unless a concrete requirement emerges.

## 8. M2 backend scope

M2 will implement and independently test:
1. Worker foundation
2. /health
3. /v1/tweet/generate
4. Request validation
5. Prompt construction
6. OpenAI integration
7. Tweet length validation
8. Regeneration support
9. Error handling
10. Security basics
11. Automated tests

The backend must be usable independently before M1 begins.

## 9. M1 extension scope

After M2 is working:
- Detect the X compose experience.
- Provide TweetPilot UI within/alongside the compose workflow.
- Topic selection.
- Display generated suggestion.
- Change Tweet.
- Insert the approved suggestion into the compose experience where technically and policy-wise appropriate.
- User manually uses X's native Post action.

No automated final publishing.

## 10. M3 scope

- Better personalisation
- Duplicate/repetition avoidance
- Draft/history support where useful
- Usage controls
- Better error/retry UX
- Production hardening
- Review current X platform/automation constraints before public release

## 11. Claude-assisted development

Claude may be used as a coding assistant for selected basic implementation tasks when useful.

However:
- Architecture and product decisions remain ours.
- Code generated by Claude must be reviewed.
- Tests must pass before accepting changes.
- No external AI-generated code is accepted blindly.
- The project should remain understandable and maintainable by us.

Claude is therefore an optional development aid, not a runtime dependency of TweetPilot.

## 12. M0 exit criteria

M0 is complete when:
- Architecture is documented.
- Cloudflare deployment approach is confirmed.
- API contract is documented.
- AI provider abstraction is defined.
- Security model is agreed.
- Testing approach is agreed.
- M2 implementation can begin without further architectural decisions.

## 13. Cost philosophy

TweetPilot should start with minimal recurring cost.

Initial architecture deliberately avoids:
- Always-on servers
- Database infrastructure
- X API costs
- Background AI generation

AI generation occurs only when requested. Additional infrastructure will be introduced only when justified by actual requirements.