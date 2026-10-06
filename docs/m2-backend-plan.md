# Vichar — M2 Backend Plan

## Goal

Build and independently test the Vichar AI backend before starting the Chrome extension.

## M2.1 — Worker foundation

- Create a TypeScript Cloudflare Worker project.
- Use Wrangler for local development and deployment.
- Add a minimal `/health` endpoint.
- Add Vitest test setup.
- Keep the Worker stateless initially.
- Do not create D1, KV or R2 resources.

## M2.2 — API contract

Endpoint:

    POST /v1/tweet/generate

Initial request:

    {
      "topic": "Photography",
      "location": "Chennai",
      "style": "thoughtful",
      "maxLength": 140
    }

Initial response:

    {
      "tweet": "..."
    }

The API should return predictable JSON errors for invalid requests and upstream AI failures.

## M2.3 — AI provider

Introduce a provider abstraction:

    TweetGenerator
        |
        +-- OpenAIProvider

The OpenAI implementation must remain isolated from HTTP routing and request validation.

The OpenAI API key must be provided only through a server-side secret.

## M2.4 — Generation quality

Generation should:

- Follow the selected topic.
- Use the configured personality/interests.
- Respect the requested maximum length.
- Avoid generic motivational phrasing.
- Use minimal hashtags.
- Produce conversational, thoughtful and occasionally witty text.
- Support regeneration by accepting a fresh request.
- Avoid returning empty or malformed output.

## M2.5 — Testing

Tests should cover:

- Health endpoint.
- Valid generation request.
- Invalid/missing topic.
- Invalid maximum length.
- AI provider success.
- AI provider failure.
- Over-length model output.
- Malformed provider response.
- Stable error response format.

Tests must not call the real OpenAI API by default.

## M2.6 — Deployment

Deployment is performed with Wrangler or another explicitly reviewed Cloudflare deployment mechanism.

Before production deployment:

1. Run typecheck.
2. Run all tests.
3. Build if applicable.
4. Configure the OpenAI secret.
5. Deploy a non-production/staging Worker if practical.
6. Verify `/health`.
7. Verify `/v1/tweet/generate`.
8. Record the deployed endpoint for M1.

## Development workflow

ChatGPT remains responsible for architecture, planning and review.

Claude Desktop may be used for selected coding tasks, refactoring and test generation. Claude-generated code must be reviewed and tested before acceptance.

GitHub remains the source of truth for the project.

No extension work begins until M2 has a working, independently tested backend.
