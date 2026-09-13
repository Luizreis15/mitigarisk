import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePolicyConfiguration } from "../../lib/domain/evaluation-policy-config.ts";
import { normalizeEvaluationInput } from "../../lib/domain/evaluation-input.ts";
import { NEUTRAL_FACTOR_SCORE, calculateEvaluationScore } from "../../lib/domain/evaluation-scoring.ts";
import { twoFactorPolicy } from "./evaluation-engine-fixtures.ts";

function policy() {
  const { factors, thresholds } = twoFactorPolicy();
  return validatePolicyConfiguration(factors, thresholds);
}

void test("weighted average is deterministic and matches hand computation", () => {
  const p = policy();
  // kyc_match_score (weight 40, lower_is_riskier): input 100 -> normalized 0
  // sanctions_hit_count (weight 60, higher_is_riskier): input 5 -> normalized 100
  // weighted average = (0*40 + 100*60) / 100 = 60
  const input = normalizeEvaluationInput(p, { kyc_match_score: 100, sanctions_hit_count: 5 });
  const result = calculateEvaluationScore(p, input);
  assert.equal(result.score, 60);
  assert.equal(result.band, "review");
});

void test("running the same inputs twice yields the identical score", () => {
  const p = policy();
  const facts = { kyc_match_score: 42, sanctions_hit_count: 1.5 };
  const a = calculateEvaluationScore(p, normalizeEvaluationInput(p, facts));
  const b = calculateEvaluationScore(p, normalizeEvaluationInput(p, facts));
  assert.deepEqual(a, b);
});

void test("a missing factor is scored at the neutral default, not zero or excluded", () => {
  const p = policy();
  // Only sanctions_hit_count supplied at its neutral midpoint (2.5 -> 50);
  // kyc_match_score missing -> also defaults to 50. Weighted avg should be 50.
  const input = normalizeEvaluationInput(p, { sanctions_hit_count: 2.5 });
  const result = calculateEvaluationScore(p, input);
  assert.equal(result.score, NEUTRAL_FACTOR_SCORE);
});

void test("a two-factor score of exactly 0 resolves to the approve band", () => {
  const p = policy();
  const input = normalizeEvaluationInput(p, { kyc_match_score: 100, sanctions_hit_count: 0 });
  const result = calculateEvaluationScore(p, input);
  assert.equal(result.score, 0);
  assert.equal(result.band, "approve");
});

void test("boundary scores resolve to the correct band under half-open thresholds", () => {
  // Threshold bands: [0,30) approve, [30,70) review, [70,100] reject.
  // A single-factor policy makes it possible to hit exact boundary scores.
  const singleFactor = validatePolicyConfiguration(
    [{ key: "risk", weight: 1, config: { min: 0, max: 100, direction: "higher_is_riskier", required: true } }],
    twoFactorPolicy().thresholds,
  );
  const at30 = calculateEvaluationScore(singleFactor, normalizeEvaluationInput(singleFactor, { risk: 30 }));
  assert.equal(at30.score, 30);
  assert.equal(at30.band, "review", "30 belongs to the review band, not approve");

  const at70 = calculateEvaluationScore(singleFactor, normalizeEvaluationInput(singleFactor, { risk: 70 }));
  assert.equal(at70.score, 70);
  assert.equal(at70.band, "reject", "70 belongs to the reject band, not review");

  const at100 = calculateEvaluationScore(singleFactor, normalizeEvaluationInput(singleFactor, { risk: 100 }));
  assert.equal(at100.band, "reject");

  const at0 = calculateEvaluationScore(singleFactor, normalizeEvaluationInput(singleFactor, { risk: 0 }));
  assert.equal(at0.band, "approve");

  const justBelow30 = calculateEvaluationScore(
    singleFactor,
    normalizeEvaluationInput(singleFactor, { risk: 29.99 }),
  );
  assert.equal(justBelow30.band, "approve");

  const justBelow70 = calculateEvaluationScore(
    singleFactor,
    normalizeEvaluationInput(singleFactor, { risk: 69.99 }),
  );
  assert.equal(justBelow70.band, "review");
});
