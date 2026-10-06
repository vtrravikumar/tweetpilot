# Vichar Brand Standard

## Product identity

**Vichar — By VTRRK**

Vichar is the public product name. The product must never be presented to users as TweetPilot.

Historical/internal repository and infrastructure names may remain where changing them would create deployment or compatibility risk.

## Approved messaging

- English tagline: **From thought to expression.**
- Public UI: Use Sanskrit in Roman/English script with an English translation; do not use Devanagari in the primary product experience.

## Approved visual identity

The approved artwork is the Vichar branding sheet supplied and approved by V.T.R. Ravi Kumar on 6 October 2026.

The approved primary mark is the distinctive V-shaped thought/voice/pen motif with:
- crimson/red rounded-square field for the full-colour variant;
- cream/gold V form;
- gold circular element;
- gold/orange pen/voice/feather element;
- sparkle;
- flowing gold/orange lower strokes.

**Do not redraw, approximate, reinterpret, or replace the approved mark with a generic SVG, lettermark, W/V symbol, robot, brain, chat bubble, or other substitute.**

When the original artwork asset is available, it is the source of truth for all derivatives.

## Colour palette

| Name | Hex |
|---|---|
| Crimson Red | `#DC143C` |
| Bright Red | `#FF2D3A` |
| Golden Yellow | `#FFC400` |
| Warm Orange | `#FF8A00` |
| Soft Cream | `#FFF4E6` |
| Deep Crimson | `#7A1025` |

Do not introduce blue, green, or brown into the Vichar brand palette.

## Public-facing naming

Use **Vichar** for:
- website;
- Chrome extension;
- extension UI;
- Chrome Web Store listing;
- marketing;
- user documentation;
- screenshots;
- product descriptions.

Use **thought** / **expression** for user-facing creation language where appropriate. "Tweet" remains valid when referring specifically to the X post/output format.

## Internal naming

The following may remain temporarily for compatibility:
- repository: `tweetpilot`;
- Worker hostname: `tweetpilot-api.vtrravikumar.workers.dev`;
- API route: `/v1/tweet/generate`;
- internal function names such as `generateTweet`;
- package names and environment variable names that are already deployed.

These are infrastructure/implementation names, not the product identity.

## Implementation rule

No UI implementation may invent its own logo or brand treatment. New Vichar surfaces must consume the approved artwork and palette defined here.

Current approved artwork source: the Vichar brand board supplied and approved on 6 October 2026. The public website now uses the approved light-background Vichar lockup derived from that artwork. The extension should use the same approved mark and English-first treatment. Before public release, derive the remaining 16/32/48/favicons and store assets from the same approved artwork; do not redraw them independently.
