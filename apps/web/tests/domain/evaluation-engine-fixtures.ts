import type { PolicyFactorInput, PolicyThresholdInput } from "../../lib/domain/evaluation-policy-config.ts";

// Shared, fictional, market-neutral fixtures for the deterministic
// evaluation engine test suite. No PII or real business data.

export function twoFactorPolicy(): {
  factors: PolicyFactorInput[];
  thresholds: PolicyThresholdInput[];
} {
  return {
    factors: [
      {
        key: "kyc_match_score",
        weight: 40,
        config: { min: 0, max: 100, direction: "lower_is_riskier", required: true },
      },
      {
        key: "sanctions_hit_count",
        weight: 60,
        config: { min: 0, max: 5, direction: "higher_is_riskier", required: true },
      },
    ],
    thresholds: [
      { minScore: 0, maxScore: 30, decisionBand: "approve" },
      { minScore: 30, maxScore: 70, decisionBand: "review" },
      { minScore: 70, maxScore: 100, decisionBand: "reject" },
    ],
  };
}
