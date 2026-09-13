import type { ValidatedPolicyConfiguration } from "./evaluation-policy-config";
import { MalformedEvaluationInputError, MalformedInputPayloadError } from "./evaluation-engine-errors.ts";

// Normalizes a bounded evaluation input payload (raw facts, keyed by factor
// key) against a validated policy configuration. A present value is
// clamped into its factor's configured [min, max] and mapped onto a 0-100
// normalized risk score; a missing value is reported as absent, with the
// neutral-default fill-in left to evaluation-scoring.ts so that decision
// (score math) and observation (what was actually supplied) stay separate.
//
// "Bounded" here means bounded by each factor's own min/max, not that the
// input's key set is restricted: unrecognized keys in `facts` are ignored,
// since a caller may reasonably pass a superset of facts across policy
// versions.

export interface NormalizedFactorInput {
  key: string;
  present: boolean;
  /** Only set when present is true. */
  normalizedScore: number | null;
}

export interface NormalizedEvaluationInput {
  factors: readonly NormalizedFactorInput[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeFactorValue(rawValue: number, config: ValidatedPolicyConfiguration["factors"][number]["normalization"]): number {
  const clamped = clamp(rawValue, config.min, config.max);
  const ratio = (clamped - config.min) / (config.max - config.min);
  return config.direction === "higher_is_riskier" ? ratio * 100 : (1 - ratio) * 100;
}

/**
 * Normalizes raw evaluation facts against an already-validated policy
 * configuration. Throws MalformedInputPayloadError if `facts` is not a
 * plain object, or MalformedEvaluationInputError if a supplied value for a
 * known factor key is not a finite number. A key that is absent or
 * explicitly null is treated as "not supplied," never as malformed.
 */
export function normalizeEvaluationInput(
  policy: ValidatedPolicyConfiguration,
  facts: Readonly<Record<string, unknown>>,
): NormalizedEvaluationInput {
  if (typeof facts !== "object" || facts === null || Array.isArray(facts)) {
    throw new MalformedInputPayloadError("facts must be a plain object keyed by factor key");
  }

  const normalized: NormalizedFactorInput[] = policy.factors.map((factor) => {
    const rawValue = facts[factor.key];

    if (rawValue === undefined || rawValue === null) {
      return { key: factor.key, present: false, normalizedScore: null };
    }

    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      throw new MalformedEvaluationInputError(factor.key, "value must be a finite number");
    }

    return {
      key: factor.key,
      present: true,
      normalizedScore: normalizeFactorValue(rawValue, factor.normalization),
    };
  });

  return { factors: normalized };
}
