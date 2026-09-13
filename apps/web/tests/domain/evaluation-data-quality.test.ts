import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePolicyConfiguration } from "../../lib/domain/evaluation-policy-config.ts";
import { normalizeEvaluationInput } from "../../lib/domain/evaluation-input.ts";
import { assessDataQuality } from "../../lib/domain/evaluation-data-quality.ts";
import { calculateEvaluationScore } from "../../lib/domain/evaluation-scoring.ts";
import { twoFactorPolicy } from "./evaluation-engine-fixtures.ts";

function policy() {
  const { factors, thresholds } = twoFactorPolicy();
  return validatePolicyConfiguration(factors, thresholds);
}

void test("complete when every required factor is supplied", () => {
  const p = policy();
  const input = normalizeEvaluationInput(p, { kyc_match_score: 80, sanctions_hit_count: 0 });
  const result = assessDataQuality(p, input);
  assert.equal(result.status, "complete");
  assert.deepEqual(result.missingRequiredFactorKeys, []);
});

void test("partial when some but not all required factors are supplied", () => {
  const p = policy();
  const input = normalizeEvaluationInput(p, { kyc_match_score: 80 });
  const result = assessDataQuality(p, input);
  assert.equal(result.status, "partial");
  assert.deepEqual(result.missingRequiredFactorKeys, ["sanctions_hit_count"]);
});

void test("insufficient when no required factor is supplied", () => {
  const p = policy();
  const input = normalizeEvaluationInput(p, {});
  const result = assessDataQuality(p, input);
  assert.equal(result.status, "insufficient");
  assert.deepEqual(result.missingRequiredFactorKeys, ["kyc_match_score", "sanctions_hit_count"]);
});

void test("a policy with no required factors is vacuously complete", () => {
  const p = validatePolicyConfiguration(
    [{ key: "optional_signal", weight: 1, config: { min: 0, max: 100, direction: "higher_is_riskier", required: false } }],
    twoFactorPolicy().thresholds,
  );
  const input = normalizeEvaluationInput(p, {});
  const result = assessDataQuality(p, input);
  assert.equal(result.status, "complete");
});

void test("data quality never changes the calculated score for the same present values", () => {
  const requiredConfig = { min: 0, max: 100, direction: "higher_is_riskier" as const, required: true };
  const optionalConfig = { ...requiredConfig, required: false };
  const thresholds = twoFactorPolicy().thresholds;

  const requiredPolicy = validatePolicyConfiguration(
    [{ key: "signal", weight: 1, config: requiredConfig }],
    thresholds,
  );
  const optionalPolicy = validatePolicyConfiguration(
    [{ key: "signal", weight: 1, config: optionalConfig }],
    thresholds,
  );

  // Same missing fact in both cases: one policy calls it required (-> insufficient),
  // the other does not (-> complete). The score must be identical either way.
  const requiredInput = normalizeEvaluationInput(requiredPolicy, {});
  const optionalInput = normalizeEvaluationInput(optionalPolicy, {});

  const requiredQuality = assessDataQuality(requiredPolicy, requiredInput);
  const optionalQuality = assessDataQuality(optionalPolicy, optionalInput);
  assert.equal(requiredQuality.status, "insufficient");
  assert.equal(optionalQuality.status, "complete");

  const requiredScore = calculateEvaluationScore(requiredPolicy, requiredInput);
  const optionalScore = calculateEvaluationScore(optionalPolicy, optionalInput);
  assert.equal(requiredScore.score, optionalScore.score);
  assert.equal(requiredScore.band, optionalScore.band);
});
