import {
  CRA_FACTOR_VALUE_MAX_LENGTH,
  type CraOverrideFactValue,
  type CustomerAssessmentForm,
} from "./customer-assessment.ts";

// Builds the facts document for public.run_customer_assessment() from a
// submitted assessment form (docs/tasks/TASK-035-cursor-customer-assessment-experience.md,
// phase B). Pure: the caller passes the form it re-fetched server-side and a
// reader returning every submitted value for a field name. Only keys the form
// lists are ever read, so any other submitted key is dropped by construction;
// a value outside the form's allowed list, a repeated field, or a reserved
// object key is rejected rather than silently turned into missing data. The
// database re-validates everything (22023) and alone computes the result.

/**
 * Form value of the explicit "Not known" factor option: the fact is sent as absent. Real factor values are always
 * submitted with the "value:" prefix, so no policy value can ever equal this sentinel.
 */
export const NOT_KNOWN_FACTOR_VALUE = "not_known";

const FACTOR_VALUE_PREFIX = "value:";
const FACTOR_FIELD_PREFIX = "factor.";
const OVERRIDE_FIELD_PREFIX = "override.";

/** Keys that would reach Object.prototype machinery if used as plain-object keys. */
export const RESERVED_FACT_KEYS: readonly string[] = ["__proto__", "constructor", "prototype"];

export function factorFieldName(factorKey: string): string {
  return `${FACTOR_FIELD_PREFIX}${factorKey}`;
}

export function overrideFieldName(factKey: string): string {
  return `${OVERRIDE_FIELD_PREFIX}${factKey}`;
}

export function encodeFactorValue(value: string): string {
  return `${FACTOR_VALUE_PREFIX}${value}`;
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

/** Length in Unicode code points, matching PostgreSQL char_length() used by the database's 64-character bound. */
export function codePointLength(value: string): number {
  return Array.from(value).length;
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

export class DuplicateAssessmentFieldError extends AssessmentSubmissionError {
  readonly fieldName: string;
  constructor(fieldName: string) {
    super(`The field "${fieldName}" was submitted more than once`);
    this.name = "DuplicateAssessmentFieldError";
    this.fieldName = fieldName;
  }
}

export class ReservedFactKeyError extends AssessmentSubmissionError {
  readonly factKey: string;
  constructor(factKey: string) {
    super(`The policy lists the reserved fact key "${factKey}"`);
    this.name = "ReservedFactKeyError";
    this.factKey = factKey;
  }
}

export type AssessmentFacts = Record<string, CraOverrideFactValue>;

/** Every submitted value for a field name; an absent field is an empty array. */
export type FieldReader = (name: string) => string[];

function assertNotReserved(key: string): void {
  if (RESERVED_FACT_KEYS.includes(key)) {
    throw new ReservedFactKeyError(key);
  }
}

function readSingle(readField: FieldReader, name: string): string | null {
  const values = readField(name);
  if (values.length > 1) {
    throw new DuplicateAssessmentFieldError(name);
  }
  return values.length === 1 ? values[0] : null;
}

/** Returns a null-prototype object: no submitted or policy key can reach Object.prototype. */
export function buildAssessmentFacts(form: CustomerAssessmentForm, readField: FieldReader): AssessmentFacts {
  const facts = Object.create(null) as AssessmentFacts;

  for (const category of form.categories) {
    for (const factor of category.factors) {
      assertNotReserved(factor.key);
      const submitted = readSingle(readField, factorFieldName(factor.key));
      if (submitted === null || submitted === "" || submitted === NOT_KNOWN_FACTOR_VALUE) {
        continue;
      }
      if (!submitted.startsWith(FACTOR_VALUE_PREFIX)) {
        throw new InvalidFactorAnswerError(factor.key);
      }
      const value = submitted.slice(FACTOR_VALUE_PREFIX.length);
      if (codePointLength(value) > CRA_FACTOR_VALUE_MAX_LENGTH || !factor.values.includes(value)) {
        throw new InvalidFactorAnswerError(factor.key);
      }
      facts[factor.key] = value;
    }
  }

  for (const override of form.overrides) {
    assertNotReserved(override.factKey);
    const submitted = readSingle(readField, overrideFieldName(override.factKey));
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

/**
 * The submitted values to echo back after a failed run, so the form can be re-rendered with the user's answers.
 * Only field names the form lists are copied (first value of each); the server stays the authority on validity.
 */
export function pickSubmittedAssessmentValues(
  form: CustomerAssessmentForm,
  readField: FieldReader,
): Record<string, string> {
  const names = [
    ...form.categories.flatMap((category) => category.factors.map((factor) => factorFieldName(factor.key))),
    ...form.overrides.map((override) => overrideFieldName(override.factKey)),
  ];
  const entries: Array<[string, string]> = [];
  for (const name of names) {
    const [first] = readField(name);
    if (typeof first === "string") entries.push([name, first]);
  }
  return Object.fromEntries(entries);
}

/** The form field an assessment submission error points at, if any. */
export function assessmentErrorField(error: unknown): string | null {
  if (error instanceof InvalidFactorAnswerError) return factorFieldName(error.factorKey);
  if (error instanceof MissingOverrideAnswerError || error instanceof InvalidOverrideAnswerError) {
    return overrideFieldName(error.factKey);
  }
  if (error instanceof DuplicateAssessmentFieldError) return error.fieldName;
  return null;
}
