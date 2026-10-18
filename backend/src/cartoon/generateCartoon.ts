import { CartoonImageError } from "./errors";
import type {
  CartoonImageProvider,
  CharacterReference,
  GenerateCartoonResult,
} from "./types";

export interface CartoonCreditLedger {
  reserveImageCredits(operationId: string, credits: number): Promise<{
    reserved: boolean;
    status: string;
    balance: number | null;
    created: boolean;
  }>;
  startImageGeneration(operationId: string): Promise<{ started: boolean; status: string }>;
  commitImageCredits(operationId: string): Promise<boolean>;
  markImageGenerationUnknown(operationId: string): Promise<boolean>;
  failImageGeneration(operationId: string): Promise<{ released: boolean; balance: number | null }>;
  releaseImageCredits(operationId: string): Promise<{ released: boolean; balance: number | null }>;
}

export type CartoonWorkflowResult =
  | { status: "generated"; image: GenerateCartoonResult }
  | { status: "credits_unavailable"; reason: string; balance: number | null }
  | { status: "already_in_progress"; reason: string }
  | { status: "failed"; reason: string; creditsReleased: boolean }
  | { status: "outcome_unknown"; reason: string };

/**
 * Small, route-independent workflow. The caller must authenticate/authorize the
 * user and choose the canonical reference before calling this function.
 * No provider retries are performed.
 */
export async function generateCartoonWithCredits(options: {
  operationId: string;
  credits: number;
  thought: string;
  safetyIdentifier: string;
  characterReference: CharacterReference;
  provider: CartoonImageProvider;
  ledger: CartoonCreditLedger;
}): Promise<CartoonWorkflowResult> {
  const { operationId, credits, thought, safetyIdentifier, characterReference, provider, ledger } = options;
  const reservation = await ledger.reserveImageCredits(operationId, credits);
  if (!reservation.reserved) {
    return {
      status: "credits_unavailable",
      reason: reservation.status,
      balance: reservation.balance,
    };
  }

  const claim = await ledger.startImageGeneration(operationId);
  if (!claim.started) {
    // A replay must not call the provider or release credits owned by another attempt.
    return { status: "already_in_progress", reason: claim.status };
  }

  try {
    const image = await provider.generate({
      operationId,
      thought,
      safetyIdentifier,
      characterReference,
    });
    const committed = await ledger.commitImageCredits(operationId);
    if (!committed) {
      // The image exists, but accounting could not be confirmed. Do not refund.
      await ledger.markImageGenerationUnknown(operationId);
      return { status: "outcome_unknown", reason: "image_created_accounting_unconfirmed" };
    }
    return { status: "generated", image };
  } catch (error) {
    const outcome = error instanceof CartoonImageError ? error.outcome : "unknown";
    if (outcome === "definitive_failure") {
      const settlement = await ledger.failImageGeneration(operationId);
      return {
        status: "failed",
        reason: error instanceof CartoonImageError ? error.kind : "provider_failure",
        creditsReleased: settlement.released,
      };
    }

    await ledger.markImageGenerationUnknown(operationId);
    return {
      status: "outcome_unknown",
      reason: error instanceof CartoonImageError ? error.kind : "provider_outcome_unknown",
    };
  }
}
