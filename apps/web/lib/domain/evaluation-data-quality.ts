import type { NormalizedEvaluationInput } from "./evaluation-input";
import type { ValidatedPolicyConfiguration } from "./evaluation-policy-config";

// Assesses data quality separately from risk scoring: which required
// factors were actually supplied, distinct from what the score came out to
// (docs/architecture/PLATFORM-ARCHITECTURE.md, "distinguish data-quality
// state" from a risk result). See evaluation-scoring.ts for why the score
// itself never depends on this classification.

export type DataQualityStatus = "complete" | "partial" | "insufficient";

export interface DataQualityResult {
  status: DataQualityStatus;
  missingRequiredFactorKeys: readonly string[];
}

/**
 * "complete": every required factor was supplied.
 * "partial": some, but not all, required factors were supplied.
 * "insufficient": no required factor was supplied (or none exist to
 * require, which is treated as vacuously "complete").
 */
export function assessDataQuality(
  policy: ValidatedPolicyConfiguration,
  input: NormalizedEvaluationInput,
): DataQualityResult {
  const presentByKey = new Map(input.factors.map((f) => [f.key, f.present]));
  const requiredFactors = policy.factors.filter((f) => f.normalization.required);

  if (requiredFactors.length === 0) {
    return { status: "complete", missingRequiredFactorKeys: [] };
  }

  const missingRequiredFactorKeys = requiredFactors
    .filter((f) => !presentByKey.get(f.key))
    .map((f) => f.key);

  if (missingRequiredFactorKeys.length === 0) {
    return { status: "complete", missingRequiredFactorKeys: [] };
  }
  if (missingRequiredFactorKeys.length === requiredFactors.length) {
    return { status: "insufficient", missingRequiredFactorKeys };
  }
  return { status: "partial", missingRequiredFactorKeys };
}
