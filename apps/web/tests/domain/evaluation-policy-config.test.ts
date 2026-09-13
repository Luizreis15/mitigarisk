import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePolicyConfiguration } from "../../lib/domain/evaluation-policy-config.ts";
import {
  DuplicateFactorKeyError,
  InvalidDecisionBandError,
  InvalidFactorConfigError,
  InvalidFactorWeightError,
  InvalidThresholdRangeError,
  NoFactorsError,
  NoThresholdsError,
  ThresholdCoverageError,
} from "../../lib/domain/evaluation-engine-errors.ts";
import type { PolicyThresholdInput } from "../../lib/domain/evaluation-policy-config.ts";
import { twoFactorPolicy } from "./evaluation-engine-fixtures.ts";

void test("validatePolicyConfiguration accepts a well-formed policy", () => {
  const { factors, thresholds } = twoFactorPolicy();
  const result = validatePolicyConfiguration(factors, thresholds);
  assert.equal(result.factors.length, 2);
  assert.equal(result.thresholds.length, 3);
  assert.equal(result.totalWeight, 100);
});

void test("rejects a policy with no factors", () => {
  const { thresholds } = twoFactorPolicy();
  assert.throws(() => validatePolicyConfiguration([], thresholds), NoFactorsError);
});

void test("rejects duplicate factor keys", () => {
  const { factors, thresholds } = twoFactorPolicy();
  assert.throws(
    () => validatePolicyConfiguration([...factors, factors[0]], thresholds),
    DuplicateFactorKeyError,
  );
});

void test("rejects invalid factor weights", () => {
  const { factors, thresholds } = twoFactorPolicy();
  for (const badWeight of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const bad = [{ ...factors[0], weight: badWeight }, factors[1]];
    assert.throws(() => validatePolicyConfiguration(bad, thresholds), InvalidFactorWeightError);
  }
});

void test("rejects malformed factor normalization config", () => {
  const { factors, thresholds } = twoFactorPolicy();
  const cases: Record<string, unknown>[] = [
    { max: 100, direction: "higher_is_riskier", required: true }, // missing min
    { min: 0, direction: "higher_is_riskier", required: true }, // missing max
    { min: 100, max: 0, direction: "higher_is_riskier", required: true }, // max <= min
    { min: 0, max: 100, direction: "sideways", required: true }, // bad direction
    { min: 0, max: 100, direction: "higher_is_riskier", required: "yes" }, // bad required type
  ];
  for (const config of cases) {
    const bad = [{ ...factors[0], config }, factors[1]];
    assert.throws(() => validatePolicyConfiguration(bad, thresholds), InvalidFactorConfigError);
  }
});

void test("rejects a policy with no thresholds", () => {
  const { factors } = twoFactorPolicy();
  assert.throws(() => validatePolicyConfiguration(factors, []), NoThresholdsError);
});

void test("rejects an inverted threshold range", () => {
  const { factors } = twoFactorPolicy();
  const thresholds = [{ minScore: 100, maxScore: 0, decisionBand: "approve" as const }];
  assert.throws(() => validatePolicyConfiguration(factors, thresholds), InvalidThresholdRangeError);
});

void test("rejects thresholds that do not start at 0", () => {
  const { factors } = twoFactorPolicy();
  const thresholds = [
    { minScore: 10, maxScore: 70, decisionBand: "review" as const },
    { minScore: 70, maxScore: 100, decisionBand: "reject" as const },
  ];
  assert.throws(() => validatePolicyConfiguration(factors, thresholds), ThresholdCoverageError);
});

void test("rejects thresholds that do not end at 100", () => {
  const { factors } = twoFactorPolicy();
  const thresholds = [
    { minScore: 0, maxScore: 30, decisionBand: "approve" as const },
    { minScore: 30, maxScore: 90, decisionBand: "reject" as const },
  ];
  assert.throws(() => validatePolicyConfiguration(factors, thresholds), ThresholdCoverageError);
});

void test("rejects overlapping thresholds", () => {
  const { factors } = twoFactorPolicy();
  const thresholds = [
    { minScore: 0, maxScore: 40, decisionBand: "approve" as const },
    { minScore: 30, maxScore: 100, decisionBand: "reject" as const },
  ];
  assert.throws(() => validatePolicyConfiguration(factors, thresholds), ThresholdCoverageError);
});

void test("rejects thresholds with a coverage gap", () => {
  const { factors } = twoFactorPolicy();
  const thresholds = [
    { minScore: 0, maxScore: 30, decisionBand: "approve" as const },
    { minScore: 40, maxScore: 100, decisionBand: "reject" as const },
  ];
  assert.throws(() => validatePolicyConfiguration(factors, thresholds), ThresholdCoverageError);
});

// decisionBand is only a compile-time contract (DecisionBand = "approve" |
// "review" | "reject"); an untyped caller can hand this engine any string
// at runtime, so it must be checked explicitly. These tests bypass the
// compiler with an unsafe cast to exercise exactly that path.
void test("rejects a threshold whose decisionBand is not approve/review/reject", () => {
  const { factors } = twoFactorPolicy();
  const badValues: unknown[] = ["allow", "decline", "APPROVE", "", null, undefined, 1, {}, ["approve"]];

  for (const badValue of badValues) {
    const thresholds = [
      { minScore: 0, maxScore: 30, decisionBand: badValue },
      { minScore: 30, maxScore: 100, decisionBand: "reject" as const },
    ] as unknown as PolicyThresholdInput[];
    assert.throws(
      () => validatePolicyConfiguration(factors, thresholds),
      InvalidDecisionBandError,
      `expected rejection for decisionBand = ${JSON.stringify(badValue)}`,
    );
  }
});

void test("still accepts every genuinely valid decisionBand", () => {
  const { factors } = twoFactorPolicy();
  const thresholds: PolicyThresholdInput[] = [
    { minScore: 0, maxScore: 30, decisionBand: "approve" },
    { minScore: 30, maxScore: 70, decisionBand: "review" },
    { minScore: 70, maxScore: 100, decisionBand: "reject" },
  ];
  const result = validatePolicyConfiguration(factors, thresholds);
  assert.deepEqual(
    result.thresholds.map((t) => t.decisionBand),
    ["approve", "review", "reject"],
  );
});
