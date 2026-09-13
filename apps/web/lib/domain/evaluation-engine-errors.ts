// Typed domain errors for the deterministic evaluation engine
// (apps/web/lib/domain/evaluation-engine.ts and its helper modules).
// Every failure mode listed in
// docs/tasks/TASK-009-claude-deterministic-evaluation-engine.md ("Invalid
// factors, duplicate keys, invalid weights, overlapping/uncovered
// thresholds, and malformed inputs") is one of these — the engine never
// throws a bare Error, so a future API adapter can pattern-match on
// `instanceof` to render a stable error response.
//
// Fields are assigned in each constructor body, not via TS parameter-
// property shorthand: Node's type-stripping test runner
// (apps/web/tests/**/*.test.ts run via `node --test`) does not support
// parameter properties.

export abstract class PolicyConfigurationError extends Error {}

export class NoFactorsError extends PolicyConfigurationError {
  constructor() {
    super("A policy configuration must define at least one factor");
    this.name = "NoFactorsError";
  }
}

export class DuplicateFactorKeyError extends PolicyConfigurationError {
  readonly factorKey: string;
  constructor(factorKey: string) {
    super(`Duplicate factor key: "${factorKey}"`);
    this.name = "DuplicateFactorKeyError";
    this.factorKey = factorKey;
  }
}

export class InvalidFactorWeightError extends PolicyConfigurationError {
  readonly factorKey: string;
  constructor(factorKey: string) {
    super(`Factor "${factorKey}" has an invalid weight: weight must be a finite number greater than zero`);
    this.name = "InvalidFactorWeightError";
    this.factorKey = factorKey;
  }
}

export class InvalidFactorConfigError extends PolicyConfigurationError {
  readonly factorKey: string;
  readonly reason: string;
  constructor(factorKey: string, reason: string) {
    super(`Factor "${factorKey}" has an invalid normalization config: ${reason}`);
    this.name = "InvalidFactorConfigError";
    this.factorKey = factorKey;
    this.reason = reason;
  }
}

export class NoThresholdsError extends PolicyConfigurationError {
  constructor() {
    super("A policy configuration must define at least one score threshold");
    this.name = "NoThresholdsError";
  }
}

export class InvalidThresholdRangeError extends PolicyConfigurationError {
  readonly label: string;
  constructor(label: string) {
    super(`Threshold "${label}" has an invalid range: minScore must be less than maxScore`);
    this.name = "InvalidThresholdRangeError";
    this.label = label;
  }
}

export class ThresholdCoverageError extends PolicyConfigurationError {
  readonly reason: string;
  constructor(reason: string) {
    super(`Score thresholds do not exhaustively and non-overlappingly cover the scoring range: ${reason}`);
    this.name = "ThresholdCoverageError";
    this.reason = reason;
  }
}

export class MalformedEvaluationInputError extends Error {
  readonly factorKey: string;
  constructor(factorKey: string, reason: string) {
    super(`Malformed input for factor "${factorKey}": ${reason}`);
    this.name = "MalformedEvaluationInputError";
    this.factorKey = factorKey;
  }
}

export class MalformedInputPayloadError extends Error {
  constructor(reason: string) {
    super(`Malformed evaluation input payload: ${reason}`);
    this.name = "MalformedInputPayloadError";
  }
}
