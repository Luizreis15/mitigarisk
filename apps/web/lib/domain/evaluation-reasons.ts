import type { DecisionBand } from "./policy";
import type { NormalizedEvaluationInput } from "./evaluation-input";
import type { ValidatedPolicyConfiguration } from "./evaluation-policy-config";
import { NEUTRAL_FACTOR_SCORE } from "./evaluation-scoring.ts";

// Emits stable, English, technical reason-code tokens with non-sensitive
// explanation metadata: abstracted 0-100 normalized scores and factor
// keys/weights only — never a raw input value
// (docs/tasks/TASK-009-claude-deterministic-evaluation-engine.md, "Never
// emit raw PII or full input values in reason metadata"). Presentation
// copy for these codes belongs to a later UI layer, not this engine.

export const FACTOR_LOW_RISK_MAX = 30;
export const FACTOR_HIGH_RISK_MIN = 70;

export type EngineReasonCode =
  | "FACTOR_INPUT_MISSING"
  | "FACTOR_LOW_RISK_CONTRIBUTION"
  | "FACTOR_MODERATE_RISK_CONTRIBUTION"
  | "FACTOR_HIGH_RISK_CONTRIBUTION"
  | "RECOMMENDATION_APPROVE"
  | "RECOMMENDATION_REVIEW"
  | "RECOMMENDATION_REJECT";

export interface EvaluationReason {
  code: EngineReasonCode;
  description: string;
  metadata: Readonly<Record<string, string | number | boolean>>;
}

function recommendationReasonCode(band: DecisionBand): EngineReasonCode {
  switch (band) {
    case "approve":
      return "RECOMMENDATION_APPROVE";
    case "review":
      return "RECOMMENDATION_REVIEW";
    case "reject":
      return "RECOMMENDATION_REJECT";
  }
}

function factorContributionCode(normalizedScore: number): EngineReasonCode {
  if (normalizedScore < FACTOR_LOW_RISK_MAX) return "FACTOR_LOW_RISK_CONTRIBUTION";
  if (normalizedScore >= FACTOR_HIGH_RISK_MIN) return "FACTOR_HIGH_RISK_CONTRIBUTION";
  return "FACTOR_MODERATE_RISK_CONTRIBUTION";
}

/**
 * Reasons are emitted in policy factor definition order (stable and
 * deterministic across identical inputs), one per factor, followed by
 * exactly one recommendation-band reason.
 */
export function deriveEvaluationReasons(
  policy: ValidatedPolicyConfiguration,
  input: NormalizedEvaluationInput,
  score: number,
  band: DecisionBand,
): EvaluationReason[] {
  const byKey = new Map(input.factors.map((f) => [f.key, f]));
  const reasons: EvaluationReason[] = [];

  for (const factor of policy.factors) {
    const normalized = byKey.get(factor.key);
    const weightShare = roundShare(factor.weight / policy.totalWeight);

    if (!normalized?.present || normalized.normalizedScore === null) {
      reasons.push({
        code: "FACTOR_INPUT_MISSING",
        description: "No input was supplied for this factor; a neutral default score was used.",
        metadata: {
          factorKey: factor.key,
          required: factor.normalization.required,
          neutralScore: NEUTRAL_FACTOR_SCORE,
          weightShare,
        },
      });
      continue;
    }

    reasons.push({
      code: factorContributionCode(normalized.normalizedScore),
      description: "This factor's normalized score contributed to the overall risk score.",
      metadata: {
        factorKey: factor.key,
        normalizedScore: normalized.normalizedScore,
        weightShare,
      },
    });
  }

  reasons.push({
    code: recommendationReasonCode(band),
    description: "Overall score resolved to this policy recommendation band.",
    metadata: { score },
  });

  return reasons;
}

function roundShare(value: number): number {
  return Math.round(value * 10000) / 10000;
}
