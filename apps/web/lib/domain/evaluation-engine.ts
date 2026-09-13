import type { CorrelationId, PolicyVersionId } from "./ids";
import type { DecisionBand } from "./policy";
import {
  type PolicyFactorInput,
  type PolicyThresholdInput,
  validatePolicyConfiguration,
} from "./evaluation-policy-config.ts";
import { normalizeEvaluationInput } from "./evaluation-input.ts";
import { calculateEvaluationScore } from "./evaluation-scoring.ts";
import { assessDataQuality, type DataQualityStatus } from "./evaluation-data-quality.ts";
import { deriveEvaluationReasons, type EvaluationReason } from "./evaluation-reasons.ts";
import { UnsupportedContractVersionError } from "./evaluation-engine-errors.ts";

// The single, versioned entry point a future Evaluation API adapter calls.
// Framework-independent and free of any Supabase/network/IO call: given the
// same validated policy configuration and normalized facts, runEvaluation
// always produces the same result (docs/tasks/TASK-009-claude-deterministic-evaluation-engine.md,
// acceptance criterion 1). It produces a *recommendation*, never a
// decision: recommendation reuses the same approve/review/reject
// vocabulary as policy_thresholds.decision_band and evaluations.decision_band
// (supabase/migrations/20260912120200_risk_policy.sql,
// 20260912120300_evaluation.sql) rather than inventing new literal values,
// per this task's instruction to reuse, not change, the existing database
// contract's meaning — see docs/adr/0007-deterministic-evaluation-engine.md.
//
// Bumping EVALUATION_ENGINE_CONTRACT_VERSION is required for any change to
// EvaluationEngineInput/EvaluationEngineResult's shape or meaning; adapters
// should reject a contract version they were not built against rather than
// guess at compatibility.
export const EVALUATION_ENGINE_CONTRACT_VERSION = 1;

export interface EvaluationEngineInput {
  contractVersion: typeof EVALUATION_ENGINE_CONTRACT_VERSION;
  /** Identity of the immutable, published policy version these factors/thresholds came from. Passed through, not validated against a database. */
  policyVersionId: PolicyVersionId;
  /** Caller-supplied correlation id for later audit linkage; this engine never writes an audit event itself. */
  correlationId: CorrelationId;
  factors: readonly PolicyFactorInput[];
  thresholds: readonly PolicyThresholdInput[];
  /** Raw evaluation facts, keyed by factor key. */
  facts: Readonly<Record<string, unknown>>;
}

export interface EvaluationEngineResult {
  contractVersion: typeof EVALUATION_ENGINE_CONTRACT_VERSION;
  policyVersionId: PolicyVersionId;
  correlationId: CorrelationId;
  score: number;
  /**
   * A recommendation only — never a final business decision
   * (docs/architecture/PLATFORM-ARCHITECTURE.md, "Risk and audit
   * invariants": "A recommendation never silently becomes the customer's
   * final business decision"). Recording an actual decision is the Cases
   * bounded context's responsibility, not this engine's.
   */
  recommendation: DecisionBand;
  dataQuality: DataQualityStatus;
  missingRequiredFactorKeys: readonly string[];
  reasons: readonly EvaluationReason[];
}

/**
 * Runs the deterministic evaluation engine end to end: checks the caller's
 * contract version, validates the policy configuration, normalizes the
 * input facts, computes the score and recommendation band, assesses data
 * quality, and derives explanatory reason codes. Throws a typed error from
 * evaluation-engine-errors.ts on an unsupported contract version, any
 * invalid policy configuration, or malformed input; never returns a
 * partial result.
 */
export function runEvaluation(input: EvaluationEngineInput): EvaluationEngineResult {
  // EvaluationEngineInput.contractVersion is a compile-time-only contract:
  // an untyped or out-of-date caller (a future API adapter, most likely)
  // can hand this function any value here, and a mismatch means the caller
  // may be relying on a shape or meaning this version of the engine does
  // not implement. Checked first, before touching the policy or facts, so
  // a version mismatch never produces a result that looks valid.
  if (input.contractVersion !== EVALUATION_ENGINE_CONTRACT_VERSION) {
    throw new UnsupportedContractVersionError(input.contractVersion, EVALUATION_ENGINE_CONTRACT_VERSION);
  }

  const policy = validatePolicyConfiguration(input.factors, input.thresholds);
  const normalizedInput = normalizeEvaluationInput(policy, input.facts);
  const { score, band } = calculateEvaluationScore(policy, normalizedInput);
  const dataQuality = assessDataQuality(policy, normalizedInput);
  const reasons = deriveEvaluationReasons(policy, normalizedInput, score, band);

  return {
    contractVersion: EVALUATION_ENGINE_CONTRACT_VERSION,
    policyVersionId: input.policyVersionId,
    correlationId: input.correlationId,
    score,
    recommendation: band,
    dataQuality: dataQuality.status,
    missingRequiredFactorKeys: dataQuality.missingRequiredFactorKeys,
    reasons,
  };
}
