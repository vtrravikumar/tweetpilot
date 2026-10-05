import { INTERESTS, type Interest } from "./personalization";

/**
 * Deterministic interest selection: the foundation for a future "Surprise me"
 * topic. It is intentionally NOT wired into any endpoint or request yet.
 *
 * No randomness and no stored state: the same seed always yields the same
 * interest, so behaviour is testable and reproducible. The caller supplies
 * the seed. Consecutive integer seeds rotate through all five interests, so
 * a caller that increments a counter (or uses a day number) never repeats an
 * interest back-to-back.
 *
 * Deferred to M3: choosing the seed (e.g. from recent-topic history) and
 * exposing "Surprise me" through the API. Each INTERESTS label is already a
 * valid free-form `topic` value, so no API contract change is needed.
 */
export function selectInterest(seed: number | string): Interest {
  const n = typeof seed === "number" ? toIndexSeed(seed) : fnv1a32(seed);
  const index = ((n % INTERESTS.length) + INTERESTS.length) % INTERESTS.length;
  return INTERESTS[index] as Interest;
}

function toIndexSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.floor(seed) : 0;
}

/** 32-bit FNV-1a: small, stable string hash with no dependencies. */
function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
