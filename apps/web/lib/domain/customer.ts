import type { CustomerId, TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260927100000_customer_assessment.sql
// (docs/tasks/TASK-033-claude-customer-assessment.md). Deliberately
// minimal, matching Template v1's Customer and Geography categories and
// overrides (docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md
// P1.1/P1.2): no document numbers, addresses, or contact details.
//
// Validation here is a pre-check for a clean, early, typed error before any
// database round trip; the migration's CHECK constraints are the real,
// database-level enforcement and are the source of truth if the two ever
// disagree (same posture as apps/web/lib/domain/supplier.ts).

export const ONBOARDING_CHANNELS = ["face_to_face", "non_face_to_face"] as const;
export type CustomerOnboardingChannel = (typeof ONBOARDING_CHANNELS)[number];
export type CustomerStatus = "active" | "archived";

export interface Customer {
  id: CustomerId;
  tenantId: TenantId;
  externalReference: string;
  fullName: string;
  dateOfBirth: string;
  countryOfBirth: string;
  nationality: string;
  residenceCountry: string;
  onboardingChannel: CustomerOnboardingChannel;
  status: CustomerStatus;
  createdBy: UserId;
  updatedBy: UserId;
  createdAt: string;
  updatedAt: string;
}

/** Fields a caller may submit to create a customer. Never includes tenantId, status, or any provenance field — those are server-resolved, never browser-supplied. */
export interface CreateCustomerInput {
  externalReference: string;
  fullName: string;
  dateOfBirth: string;
  countryOfBirth: string;
  nationality: string;
  residenceCountry: string;
  onboardingChannel: CustomerOnboardingChannel;
}

export interface ValidatedCreateCustomerInput {
  externalReference: string;
  fullName: string;
  dateOfBirth: string;
  countryOfBirth: string;
  nationality: string;
  residenceCountry: string;
  onboardingChannel: CustomerOnboardingChannel;
}

export abstract class CustomerValidationError extends Error {}

export class InvalidExternalReferenceError extends CustomerValidationError {
  constructor() {
    super("External reference must be 1-100 characters");
    this.name = "InvalidExternalReferenceError";
  }
}

export class InvalidFullNameError extends CustomerValidationError {
  constructor() {
    super("Full name must be 1-200 characters");
    this.name = "InvalidFullNameError";
  }
}

export class InvalidDateOfBirthError extends CustomerValidationError {
  constructor() {
    super("Date of birth must be a valid calendar date in the past");
    this.name = "InvalidDateOfBirthError";
  }
}

export class InvalidCustomerCountryCodeError extends CustomerValidationError {
  readonly field: string;
  constructor(field: string) {
    super(`"${field}" must be a two-letter ISO 3166-1 alpha-2 code`);
    this.name = "InvalidCustomerCountryCodeError";
    this.field = field;
  }
}

export class InvalidCustomerOnboardingChannelError extends CustomerValidationError {
  constructor() {
    super('Onboarding channel must be "face_to_face" or "non_face_to_face"');
    this.name = "InvalidCustomerOnboardingChannelError";
  }
}

const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

function assertCountryCode(value: string, field: string): string {
  const normalized = normalizeCountryCode(value);
  if (!COUNTRY_CODE_RE.test(normalized)) {
    throw new InvalidCustomerCountryCodeError(field);
  }
  return normalized;
}

/**
 * Validates and normalizes a customer creation request. Throws a
 * CustomerValidationError subtype on the first invalid field; never returns
 * a partially valid result. Country codes are checked for ISO 3166-1
 * alpha-2 *shape* only — real-registry verification is out of scope.
 */
export function validateCreateCustomerInput(input: CreateCustomerInput): ValidatedCreateCustomerInput {
  const externalReference = input.externalReference.trim();
  if (externalReference.length < 1 || externalReference.length > 100) {
    throw new InvalidExternalReferenceError();
  }

  const fullName = input.fullName.trim();
  if (fullName.length < 1 || fullName.length > 200) {
    throw new InvalidFullNameError();
  }

  const dateOfBirth = input.dateOfBirth.trim();
  if (!DATE_RE.test(dateOfBirth) || Number.isNaN(Date.parse(dateOfBirth)) || Date.parse(dateOfBirth) >= Date.now()) {
    throw new InvalidDateOfBirthError();
  }

  const countryOfBirth = assertCountryCode(input.countryOfBirth, "countryOfBirth");
  const nationality = assertCountryCode(input.nationality, "nationality");
  const residenceCountry = assertCountryCode(input.residenceCountry, "residenceCountry");

  if (!ONBOARDING_CHANNELS.includes(input.onboardingChannel)) {
    throw new InvalidCustomerOnboardingChannelError();
  }

  return {
    externalReference,
    fullName,
    dateOfBirth,
    countryOfBirth,
    nationality,
    residenceCountry,
    onboardingChannel: input.onboardingChannel,
  };
}
