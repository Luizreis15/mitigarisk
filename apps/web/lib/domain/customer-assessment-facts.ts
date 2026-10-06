import {
  CRA_FACTOR_VALUE_MAX_LENGTH,
  type CraOverrideFactValue,
  type CustomerAssessmentForm,
} from "./customer-assessment.ts";

// Builds the facts document for public.run_customer_assessment() from a
// submitted assessment form (docs/tasks/TASK-035-cursor-customer-assessment-experience.md,
// phase B). Pure: the caller passes the form it re-fetched server-side and a
// reader for the submitted fields. Only keys the form lists are ever read, so
// any other submitted key is dropped by construction; a value outside the
// form's allowed list is rejected rather than silently turned into missing
// data. The database re-validates everything (22023) and alone computes the
// result.

/** Form value of the explicit "Not known" factor option: the fact is sent as absent. */
export const NOT_KNOWN_FACTOR_VALUE = "__not_known__";

const FACTOR_FIELD_PREFIX = "factor.";
const OVERRIDE_FIELD_PREFIX = "override.";

export function factorFieldName(factorKey: string): string {
  return `${FACTOR_FIELD_PREFIX}${factorKey}`;
}

export function overrideFieldName(factKey: string): string {
  return `${OVERRIDE_FIELD_PREFIX}${factKey}`;
}

/** Typed, unambiguous encoding of an override value, so the string "true" and the boolean true never collide. */
export function encodeOverrideValue(value: CraOverrideFactValue): string {
  return typeof value === "boolean" ? `boolean:${value}` : `string:${value}`;
}

export function decodeOverrideValue(encoded: string): CraOverrideFactValue | null {
  if (encoded === "boolean:true") return true;
  if (encoded === "boolean:false") return false;
  if (encoded.startsWith("string:")) return encoded.slice("string:".length);
  return null;
}

export abstract class AssessmentSubmissionError extends Error {}

export class InvalidFactorAnswerError extends AssessmentSubmissionError {
  readonly factorKey: string;
  constructor(factorKey: string) {
    super(`The answer for factor "${factorKey}" is not one of the policy's allowed values`);
    this.name = "InvalidFactorAnswerError";
    this.factorKey = factorKey;
  }
}

export class MissingOverrideAnswerError extends AssessmentSubmissionError {
  readonly factKey: string;
  constructor(factKey: string) {
    super(`The screening question "${factKey}" must be answered`);
    this.name = "MissingOverrideAnswerError";
    this.factKey = factKey;
  }
}

export class InvalidOverrideAnswerError extends AssessmentSubmissionError {
  readonly factKey: string;
  constructor(factKey: string) {
    super(`The answer for screening question "${factKey}" is not one of the policy's allowed values`);
    this.name = "InvalidOverrideAnswerError";
    this.factKey = factKey;
  }
}

export type AssessmentFacts = Record<string, CraOverrideFactValue>;

export function buildAssessmentFacts(
  form: CustomerAssessmentForm,
  readField: (name: string) => string | null,
): AssessmentFacts {
  const facts: AssessmentFacts = {};

  for (const category of form.categories) {
    for (const factor of category.factors) {
      const submitted = readField(factorFieldName(factor.key));
      if (submitted === null || submitted === "" || submitted === NOT_KNOWN_FACTOR_VALUE) {
        continue;
      }
      if (submitted.length > CRA_FACTOR_VALUE_MAX_LENGTH || !factor.values.includes(submitted)) {
        throw new InvalidFactorAnswerError(factor.key);
      }
      facts[factor.key] = submitted;
    }
  }

  for (const override of form.overrides) {
    const submitted = readField(overrideFieldName(override.factKey));
    if (submitted === null || submitted === "") {
      throw new MissingOverrideAnswerError(override.factKey);
    }
    const decoded = decodeOverrideValue(submitted);
    if (decoded === null || !override.values.some((allowed) => allowed === decoded)) {
      throw new InvalidOverrideAnswerError(override.factKey);
    }
    facts[override.factKey] = decoded;
  }

  return facts;
}
