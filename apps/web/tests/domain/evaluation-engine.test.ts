import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EVALUATION_ENGINE_CONTRACT_VERSION,
  runEvaluation,
  type EvaluationEngineInput,
} from "../../lib/domain/evaluation-engine.ts";
import {
  DuplicateFactorKeyError,
  UnsupportedContractVersionError,
} from "../../lib/domain/evaluation-engine-errors.ts";
import type { CorrelationId, PolicyVersionId } from "../../lib/domain/ids.ts";
import { twoFactorPolicy } from "./evaluation-engine-fixtures.ts";

function baseInput(overrides: Partial<EvaluationEngineInput> = {}): EvaluationEngineInput {
  const { factors, thresholds } = twoFactorPolicy();
  return {
    contractVersion: EVALUATION_ENGINE_CONTRACT_VERSION,
    policyVersionId: "20000000-0000-0000-0000-000000000001" as PolicyVersionId,
    correlationId: "40000000-0000-0000-0000-000000000001" as CorrelationId,
    factors,
    thresholds,
    facts: { kyc_match_score: 82, sanctions_hit_count: 1 },
    ...overrides,
  };
}

void test("running the same policy and facts twice produces an identical result", () => {
  const a = runEvaluation(baseInput());
  const b = runEvaluation(baseInput());
  assert.deepEqual(a, b);
});

void test("policy version id and correlation id pass through unchanged", () => {
  const input = baseInput({
    policyVersionId: "20000000-0000-0000-0000-000000000099" as PolicyVersionId,
    correlationId: "40000000-0000-0000-0000-000000000099" as CorrelationId,
  });
  const result = runEvaluation(input);
  assert.equal(result.policyVersionId, input.policyVersionId);
  assert.equal(result.correlationId, input.correlationId);
  assert.equal(result.contractVersion, EVALUATION_ENGINE_CONTRACT_VERSION);
});

void test("score, recommendation, data quality, and reasons are separate fields, never a 'decision'", () => {
  const result = runEvaluation(baseInput());
  assert.equal(typeof result.score, "number");
  assert.ok(["approve", "review", "reject"].includes(result.recommendation));
  assert.ok(["complete", "partial", "insufficient"].includes(result.dataQuality));
  assert.ok(Array.isArray(result.reasons));
  assert.ok(!("decision" in result));
  assert.ok(!("finalDecision" in result));
});

void test("an invalid policy configuration fails closed with a typed error, before touching facts", () => {
  const input = baseInput();
  const duplicated = { ...input, factors: [...input.factors, input.factors[0]] };
  assert.throws(() => runEvaluation(duplicated), DuplicateFactorKeyError);
});

// contractVersion is a compile-time-only contract; an untyped or
// out-of-date caller can hand runEvaluation any value here, so it must be
// checked explicitly, before the policy or facts are ever touched.
void test("an unsupported contract version fails closed with a typed error, before touching the policy", () => {
  for (const badVersion of [0, 2, 999, -1] as const) {
    const input = {
      ...baseInput(),
      contractVersion: badVersion as unknown as typeof EVALUATION_ENGINE_CONTRACT_VERSION,
      // A duplicate-key policy would also fail, but for a different reason;
      // proving the contract-version check wins confirms it runs first.
      factors: [...twoFactorPolicy().factors, twoFactorPolicy().factors[0]],
    };
    assert.throws(
      () => runEvaluation(input),
      UnsupportedContractVersionError,
      `expected rejection for contractVersion = ${badVersion}`,
    );
  }
});

void test("a missing required input still produces a complete, defined result", () => {
  const result = runEvaluation(baseInput({ facts: { kyc_match_score: 82 } }));
  assert.equal(typeof result.score, "number");
  assert.equal(result.dataQuality, "partial");
  assert.deepEqual(result.missingRequiredFactorKeys, ["sanctions_hit_count"]);
  assert.ok(["approve", "review", "reject"].includes(result.recommendation));
});

void test("every reason references a fixed English technical code, never presentation copy", () => {
  const result = runEvaluation(baseInput());
  const knownCodes = new Set([
    "FACTOR_INPUT_MISSING",
    "FACTOR_LOW_RISK_CONTRIBUTION",
    "FACTOR_MODERATE_RISK_CONTRIBUTION",
    "FACTOR_HIGH_RISK_CONTRIBUTION",
    "RECOMMENDATION_APPROVE",
    "RECOMMENDATION_REVIEW",
    "RECOMMENDATION_REJECT",
  ]);
  for (const reason of result.reasons) {
    assert.ok(knownCodes.has(reason.code));
  }
});
