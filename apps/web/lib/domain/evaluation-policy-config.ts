import type { DecisionBand, PolicyFactor, PolicyThreshold } from "./policy";
import {
  DuplicateFactorKeyError,
  InvalidDecisionBandError,
  InvalidFactorConfigError,
  InvalidFactorWeightError,
  InvalidThresholdRangeError,
  NoFactorsError,
  NoThresholdsError,
  ThresholdCoverageError,
} from "./evaluation-engine-errors.ts";

// Validates a policy version's factor configuration and score thresholds
// into a form the rest of the deterministic evaluation engine can trust
// without re-checking. This is the one place "invalid factors, duplicate
// keys, invalid weights, overlapping/uncovered thresholds" fail closed
// (docs/tasks/TASK-009-claude-deterministic-evaluation-engine.md).
//
// Inputs are Picks of the existing apps/web/lib/domain/policy.ts types
// (which mirror supabase/migrations/20260912120200_risk_policy.sql) so this
// engine reuses, rather than redefines, the database contract's meaning.

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

// DecisionBand (./policy.ts) is a compile-time-only contract: a caller that
// is not itself type-checked (a future API adapter deserializing an
// untrusted JSON policy payload, for instance) can hand this engine any
// string in the decisionBand field. TypeScript's structural typing gives no
// runtime guarantee, so it must be checked explicitly here — the same
// "fail closed on invalid input" posture as every other field in this
// module, and the only thing standing between an unvalidated string and
// EvaluationEngineResult.recommendation.
const DECISION_BANDS: readonly DecisionBand[] = ["approve", "review", "reject"];

function isDecisionBand(value: unknown): value is DecisionBand {
  return typeof value === "string" && (DECISION_BANDS as readonly string[]).includes(value);
}

export type FactorDirection = "higher_is_riskier" | "lower_is_riskier";

export interface FactorNormalizationConfig {
  min: number;
  max: number;
  direction: FactorDirection;
  /** Whether a missing input for this factor degrades the data-quality result. */
  required: boolean;
}

export type PolicyFactorInput = Pick<PolicyFactor, "key" | "weight" | "config">;
export type PolicyThresholdInput = Pick<PolicyThreshold, "minScore" | "maxScore" | "decisionBand">;

export interface ValidatedPolicyFactor {
  key: string;
  weight: number;
  normalization: FactorNormalizationConfig;
}

/** A threshold band, guaranteed contiguous and gap-/overlap-free by validatePolicyConfiguration. */
export interface ValidatedPolicyThreshold {
  minScore: number;
  maxScore: number;
  decisionBand: DecisionBand;
}

export interface ValidatedPolicyConfiguration {
  factors: readonly ValidatedPolicyFactor[];
  /** Sorted ascending by minScore; see resolveBand in evaluation-scoring.ts for match semantics. */
  thresholds: readonly ValidatedPolicyThreshold[];
  totalWeight: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateFactorConfig(factorKey: string, config: Record<string, unknown>): FactorNormalizationConfig {
  const { min, max, direction, required } = config;

  if (typeof min !== "number" || !Number.isFinite(min)) {
    throw new InvalidFactorConfigError(factorKey, '"min" must be a finite number');
  }
  if (typeof max !== "number" || !Number.isFinite(max)) {
    throw new InvalidFactorConfigError(factorKey, '"max" must be a finite number');
  }
  if (max <= min) {
    throw new InvalidFactorConfigError(factorKey, '"max" must be greater than "min"');
  }
  if (direction !== "higher_is_riskier" && direction !== "lower_is_riskier") {
    throw new InvalidFactorConfigError(
      factorKey,
      '"direction" must be "higher_is_riskier" or "lower_is_riskier"',
    );
  }
  if (typeof required !== "boolean") {
    throw new InvalidFactorConfigError(factorKey, '"required" must be a boolean');
  }

  return { min, max, direction, required };
}

function validateFactors(factors: readonly PolicyFactorInput[]): {
  validated: ValidatedPolicyFactor[];
  totalWeight: number;
} {
  if (factors.length === 0) {
    throw new NoFactorsError();
  }

  const seenKeys = new Set<string>();
  let totalWeight = 0;
  const validated: ValidatedPolicyFactor[] = [];

  for (const factor of factors) {
    if (seenKeys.has(factor.key)) {
      throw new DuplicateFactorKeyError(factor.key);
    }
    seenKeys.add(factor.key);

    if (typeof factor.weight !== "number" || !Number.isFinite(factor.weight) || factor.weight <= 0) {
      throw new InvalidFactorWeightError(factor.key);
    }

    if (!isPlainObject(factor.config)) {
      throw new InvalidFactorConfigError(factor.key, "config must be an object");
    }

    validated.push({
      key: factor.key,
      weight: factor.weight,
      normalization: validateFactorConfig(factor.key, factor.config),
    });
    totalWeight += factor.weight;
  }

  return { validated, totalWeight };
}

function validateThresholds(thresholds: readonly PolicyThresholdInput[]): ValidatedPolicyThreshold[] {
  if (thresholds.length === 0) {
    throw new NoThresholdsError();
  }

  for (const t of thresholds) {
    if (
      typeof t.minScore !== "number" ||
      typeof t.maxScore !== "number" ||
      !Number.isFinite(t.minScore) ||
      !Number.isFinite(t.maxScore) ||
      t.maxScore <= t.minScore
    ) {
      throw new InvalidThresholdRangeError(`${t.minScore}-${t.maxScore}`);
    }
    if (!isDecisionBand(t.decisionBand)) {
      throw new InvalidDecisionBandError(`${t.minScore}-${t.maxScore}`, t.decisionBand);
    }
  }

  const sorted = [...thresholds].sort((a, b) => a.minScore - b.minScore);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first.minScore !== SCORE_MIN) {
    throw new ThresholdCoverageError(`coverage must start at ${SCORE_MIN}, starts at ${first.minScore}`);
  }
  if (last.maxScore !== SCORE_MAX) {
    throw new ThresholdCoverageError(`coverage must end at ${SCORE_MAX}, ends at ${last.maxScore}`);
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minScore !== sorted[i - 1].maxScore) {
      throw new ThresholdCoverageError(
        `gap or overlap between ${sorted[i - 1].minScore}-${sorted[i - 1].maxScore} and ${sorted[i].minScore}-${sorted[i].maxScore}`,
      );
    }
  }

  return sorted.map((t) => ({ minScore: t.minScore, maxScore: t.maxScore, decisionBand: t.decisionBand }));
}

/**
 * Validates a policy version's factors and thresholds. Throws a
 * PolicyConfigurationError subtype on any invalid, duplicate, or
 * non-exhaustive/overlapping configuration; never returns a partially
 * valid result.
 */
export function validatePolicyConfiguration(
  factors: readonly PolicyFactorInput[],
  thresholds: readonly PolicyThresholdInput[],
): ValidatedPolicyConfiguration {
  const { validated: validatedFactors, totalWeight } = validateFactors(factors);
  const validatedThresholds = validateThresholds(thresholds);

  return { factors: validatedFactors, thresholds: validatedThresholds, totalWeight };
}
