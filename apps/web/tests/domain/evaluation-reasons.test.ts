import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePolicyConfiguration } from "../../lib/domain/evaluation-policy-config.ts";
import { normalizeEvaluationInput } from "../../lib/domain/evaluation-input.ts";
import { calculateEvaluationScore } from "../../lib/domain/evaluation-scoring.ts";
import { deriveEvaluationReasons } from "../../lib/domain/evaluation-reasons.ts";
import { twoFactorPolicy } from "./evaluation-engine-fixtures.ts";

function policy() {
  const { factors, thresholds } = twoFactorPolicy();
  return validatePolicyConfiguration(factors, thresholds);
}

void test("reasons are emitted in policy factor order, then the recommendation reason", () => {
  const p = policy();
  const input = normalizeEvaluationInput(p, { kyc_match_score: 80, sanctions_hit_count: 1 });
  const { score, band } = calculateEvaluationScore(p, input);
  const reasons = deriveEvaluationReasons(p, input, score, band);

  assert.equal(reasons.length, 3);
  assert.equal((reasons[0].metadata as { factorKey: string }).factorKey, "kyc_match_score");
  assert.equal((reasons[1].metadata as { factorKey: string }).factorKey, "sanctions_hit_count");
  assert.ok(reasons[2].code.startsWith("RECOMMENDATION_"));
});

void test("a missing factor always produces FACTOR_INPUT_MISSING", () => {
  const p = policy();
  const input = normalizeEvaluationInput(p, { kyc_match_score: 80 });
  const { score, band } = calculateEvaluationScore(p, input);
  const reasons = deriveEvaluationReasons(p, input, score, band);
  const missing = reasons.find((r) => (r.metadata as { factorKey?: string }).factorKey === "sanctions_hit_count");
  assert.equal(missing?.code, "FACTOR_INPUT_MISSING");
});

void test("factor contribution codes are stable across the low/moderate/high bands", () => {
  const p = policy();

  const low = normalizeEvaluationInput(p, { kyc_match_score: 100, sanctions_hit_count: 0 }); // sanctions -> 0
  const lowScore = calculateEvaluationScore(p, low);
  const lowReasons = deriveEvaluationReasons(p, low, lowScore.score, lowScore.band);
  assert.equal(
    lowReasons.find((r) => (r.metadata as { factorKey?: string }).factorKey === "sanctions_hit_count")?.code,
    "FACTOR_LOW_RISK_CONTRIBUTION",
  );

  const moderate = normalizeEvaluationInput(p, { kyc_match_score: 100, sanctions_hit_count: 2.5 }); // -> 50
  const moderateScore = calculateEvaluationScore(p, moderate);
  const moderateReasons = deriveEvaluationReasons(p, moderate, moderateScore.score, moderateScore.band);
  assert.equal(
    moderateReasons.find((r) => (r.metadata as { factorKey?: string }).factorKey === "sanctions_hit_count")?.code,
    "FACTOR_MODERATE_RISK_CONTRIBUTION",
  );

  const high = normalizeEvaluationInput(p, { kyc_match_score: 100, sanctions_hit_count: 5 }); // -> 100
  const highScore = calculateEvaluationScore(p, high);
  const highReasons = deriveEvaluationReasons(p, high, highScore.score, highScore.band);
  assert.equal(
    highReasons.find((r) => (r.metadata as { factorKey?: string }).factorKey === "sanctions_hit_count")?.code,
    "FACTOR_HIGH_RISK_CONTRIBUTION",
  );
});

void test("recommendation reason code matches the resolved band", () => {
  const p = policy();
  const input = normalizeEvaluationInput(p, { kyc_match_score: 100, sanctions_hit_count: 0 });
  const { score, band } = calculateEvaluationScore(p, input);
  const reasons = deriveEvaluationReasons(p, input, score, band);
  const recommendationReason = reasons.at(-1)!;
  assert.equal(band, "approve");
  assert.equal(recommendationReason.code, "RECOMMENDATION_APPROVE");
});

void test("reason metadata never contains a raw fact value, only abstracted scores/shares", () => {
  const p = policy();
  const input = normalizeEvaluationInput(p, { kyc_match_score: 12.3456, sanctions_hit_count: 1 });
  const { score, band } = calculateEvaluationScore(p, input);
  const reasons = deriveEvaluationReasons(p, input, score, band);
  for (const reason of reasons) {
    assert.ok(!("rawValue" in reason.metadata));
    assert.ok(!Object.values(reason.metadata).includes(12.3456));
  }
});
