import type { DecisionBand } from "./policy";
import type { NormalizedEvaluationInput } from "./evaluation-input";
import type { ValidatedPolicyConfiguration, ValidatedPolicyThreshold } from "./evaluation-policy-config";

// Deterministically calculates a score and risk band from factor weights.
// This module never looks at data quality: a missing factor's contribution
// is a fixed neutral default (NEUTRAL_FACTOR_SCORE), so the score a policy
// produces for a given set of *present* values never changes depending on
// which other factors happened to be missing or how that missingness is
// later classified (docs/tasks/TASK-009-claude-deterministic-evaluation-engine.md:
// "the invariant that data quality does not alter the calculated score").

/**
 * Score assigned to a missing factor: the midpoint of the 0-100 scale,
 * i.e. "unknown risk," not "no risk." This keeps the weighted average
 * always defined (no division by a possibly-zero present-weight subset)
 * and keeps the score a pure function of (which values were supplied, and
 * what they were) — never of a data-quality classification computed from
 * the same facts.
 */
export const NEUTRAL_FACTOR_SCORE = 50;

export interface EvaluationScoreResult {
  score: number;
  band: DecisionBand;
}

function resolveBand(score: number, thresholds: readonly ValidatedPolicyThreshold[]): DecisionBand {
  const lastIndex = thresholds.length - 1;
  for (let i = 0; i < thresholds.length; i++) {
    const t = thresholds[i];
    const isLast = i === lastIndex;
    if (score >= t.minScore && (score < t.maxScore || isLast)) {
      return t.decisionBand;
    }
  }
  // Unreachable when thresholds were produced by validatePolicyConfiguration,
  // which guarantees exhaustive [SCORE_MIN, SCORE_MAX] coverage.
  throw new Error(`Score ${score} is not covered by any validated threshold`);
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Weighted average of each factor's normalized score (0-100), using
 * NEUTRAL_FACTOR_SCORE for any factor without a supplied value, then mapped
 * onto the policy's validated decision band. Deterministic: the same
 * policy configuration and normalized input always produce the same score
 * and band.
 */
export function calculateEvaluationScore(
  policy: ValidatedPolicyConfiguration,
  input: NormalizedEvaluationInput,
): EvaluationScoreResult {
  const byKey = new Map(input.factors.map((f) => [f.key, f]));

  let weightedSum = 0;
  for (const factor of policy.factors) {
    const normalized = byKey.get(factor.key);
    const factorScore =
      normalized?.present && normalized.normalizedScore !== null ? normalized.normalizedScore : NEUTRAL_FACTOR_SCORE;
    weightedSum += factorScore * factor.weight;
  }

  const score = roundScore(weightedSum / policy.totalWeight);
  return { score, band: resolveBand(score, policy.thresholds) };
}
