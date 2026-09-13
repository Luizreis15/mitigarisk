import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePolicyConfiguration } from "../../lib/domain/evaluation-policy-config.ts";
import { normalizeEvaluationInput } from "../../lib/domain/evaluation-input.ts";
import {
  MalformedEvaluationInputError,
  MalformedInputPayloadError,
} from "../../lib/domain/evaluation-engine-errors.ts";
import { twoFactorPolicy } from "./evaluation-engine-fixtures.ts";

function policy() {
  const { factors, thresholds } = twoFactorPolicy();
  return validatePolicyConfiguration(factors, thresholds);
}

void test("higher_is_riskier maps min -> 0 and max -> 100", () => {
  const result = normalizeEvaluationInput(policy(), { sanctions_hit_count: 0, kyc_match_score: 100 });
  const byKey = Object.fromEntries(result.factors.map((f) => [f.key, f.normalizedScore]));
  assert.equal(byKey.sanctions_hit_count, 0);
});

void test("higher_is_riskier maps max -> 100", () => {
  const result = normalizeEvaluationInput(policy(), { sanctions_hit_count: 5, kyc_match_score: 100 });
  const byKey = Object.fromEntries(result.factors.map((f) => [f.key, f.normalizedScore]));
  assert.equal(byKey.sanctions_hit_count, 100);
});

void test("lower_is_riskier inverts: min -> 100, max -> 0", () => {
  const result = normalizeEvaluationInput(policy(), { kyc_match_score: 0, sanctions_hit_count: 0 });
  let byKey = Object.fromEntries(result.factors.map((f) => [f.key, f.normalizedScore]));
  assert.equal(byKey.kyc_match_score, 100);

  const result2 = normalizeEvaluationInput(policy(), { kyc_match_score: 100, sanctions_hit_count: 0 });
  byKey = Object.fromEntries(result2.factors.map((f) => [f.key, f.normalizedScore]));
  assert.equal(byKey.kyc_match_score, 0);
});

void test("midpoint input normalizes to 50 regardless of direction", () => {
  const result = normalizeEvaluationInput(policy(), { kyc_match_score: 50, sanctions_hit_count: 2.5 });
  const byKey = Object.fromEntries(result.factors.map((f) => [f.key, f.normalizedScore]));
  assert.equal(byKey.kyc_match_score, 50);
  assert.equal(byKey.sanctions_hit_count, 50);
});

void test("out-of-range values are clamped, not rejected", () => {
  const result = normalizeEvaluationInput(policy(), { kyc_match_score: -50, sanctions_hit_count: 999 });
  const byKey = Object.fromEntries(result.factors.map((f) => [f.key, f.normalizedScore]));
  assert.equal(byKey.kyc_match_score, 100); // clamped to min(0) -> riskiest since lower_is_riskier
  assert.equal(byKey.sanctions_hit_count, 100); // clamped to max(5)
});

void test("a missing or null key is reported absent, not malformed", () => {
  const result = normalizeEvaluationInput(policy(), { kyc_match_score: 80, sanctions_hit_count: null });
  const sanctions = result.factors.find((f) => f.key === "sanctions_hit_count")!;
  assert.equal(sanctions.present, false);
  assert.equal(sanctions.normalizedScore, null);

  const result2 = normalizeEvaluationInput(policy(), { kyc_match_score: 80 });
  const sanctions2 = result2.factors.find((f) => f.key === "sanctions_hit_count")!;
  assert.equal(sanctions2.present, false);
});

void test("a non-numeric value for a known factor is malformed", () => {
  for (const badValue of ["high", Number.NaN, Number.POSITIVE_INFINITY, {}, [], true]) {
    assert.throws(
      () => normalizeEvaluationInput(policy(), { kyc_match_score: badValue, sanctions_hit_count: 1 }),
      MalformedEvaluationInputError,
    );
  }
});

void test("unrecognized keys in the payload are ignored", () => {
  const result = normalizeEvaluationInput(policy(), {
    kyc_match_score: 80,
    sanctions_hit_count: 1,
    unrelated_future_field: "anything",
  });
  assert.equal(result.factors.length, 2);
});

void test("a non-object facts payload is a malformed payload, not per-factor", () => {
  for (const bad of [null, [1, 2], "nope", 42] as const) {
    assert.throws(() => normalizeEvaluationInput(policy(), bad as never), MalformedInputPayloadError);
  }
});
