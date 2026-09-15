import type { TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260914120100_suppliers.sql
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md, "Initial
// supplier fields"). Deliberately minimal: only the fields the first
// deterministic evaluation needs. No personal documents, phone numbers,
// personal addresses, bank credentials, or beneficial-owner personal
// details are modeled here — that is out of scope for this slice.
//
// Validation here is a pre-check for a clean, early, typed error before any
// database round trip; the migration's CHECK constraints are the real,
// database-level enforcement and are the source of truth if the two ever
// disagree (same posture as apps/web/lib/domain/auth-session.ts).

export type SupplierStatus = "draft" | "ready" | "evaluated" | "archived";
export type OnboardingChannel = "web" | "api" | "assisted";

export interface Supplier {
  id: string;
  tenantId: TenantId;
  reference: string;
  displayName: string;
  relationshipType: "supplier";
  registrationCountryCode: string;
  registrationIdentifier: string;
  industryCode: string;
  operatingCountryCodes: readonly string[];
  relationshipPurpose: string;
  annualExposureMinor: number;
  annualExposureCurrency: string;
  onboardingChannel: OnboardingChannel;
  websiteDomain: string | null;
  status: SupplierStatus;
  createdBy: UserId;
  updatedBy: UserId;
  createdAt: string;
  updatedAt: string;
}

/** Fields a caller may submit to create a supplier. Never includes tenantId, status, or any provenance field — those are server-resolved, never browser-supplied. */
export interface CreateSupplierInput {
  reference: string;
  displayName: string;
  registrationCountryCode: string;
  registrationIdentifier: string;
  industryCode: string;
  operatingCountryCodes: readonly string[];
  relationshipPurpose: string;
  annualExposureMinor: number;
  annualExposureCurrency: string;
  onboardingChannel: OnboardingChannel;
  websiteDomain?: string | null;
}

export interface ValidatedCreateSupplierInput {
  reference: string;
  displayName: string;
  registrationCountryCode: string;
  registrationIdentifier: string;
  industryCode: string;
  operatingCountryCodes: readonly string[];
  relationshipPurpose: string;
  annualExposureMinor: number;
  annualExposureCurrency: string;
  onboardingChannel: OnboardingChannel;
  websiteDomain: string | null;
}

export abstract class SupplierValidationError extends Error {}

export class InvalidSupplierReferenceError extends SupplierValidationError {
  constructor() {
    super("Supplier reference must be 1-64 characters");
    this.name = "InvalidSupplierReferenceError";
  }
}

export class InvalidSupplierDisplayNameError extends SupplierValidationError {
  constructor() {
    super("Supplier display name must be 1-200 characters");
    this.name = "InvalidSupplierDisplayNameError";
  }
}

export class InvalidCountryCodeError extends SupplierValidationError {
  readonly field: string;
  constructor(field: string) {
    super(`"${field}" must be a two-letter ISO 3166-1 alpha-2 code`);
    this.name = "InvalidCountryCodeError";
    this.field = field;
  }
}

export class InvalidRegistrationIdentifierError extends SupplierValidationError {
  constructor() {
    super("Registration identifier must be 1-100 characters");
    this.name = "InvalidRegistrationIdentifierError";
  }
}

export class InvalidIndustryCodeError extends SupplierValidationError {
  constructor() {
    super("Industry code must be 1-100 characters");
    this.name = "InvalidIndustryCodeError";
  }
}

export class InvalidOperatingCountryCodesError extends SupplierValidationError {
  constructor() {
    super("At least one valid operating country code is required");
    this.name = "InvalidOperatingCountryCodesError";
  }
}

export class InvalidRelationshipPurposeError extends SupplierValidationError {
  constructor() {
    super("Relationship purpose must be 1-2000 characters");
    this.name = "InvalidRelationshipPurposeError";
  }
}

export class InvalidAnnualExposureError extends SupplierValidationError {
  constructor() {
    super("Annual exposure must be a non-negative integer number of minor currency units");
    this.name = "InvalidAnnualExposureError";
  }
}

export class InvalidCurrencyCodeError extends SupplierValidationError {
  constructor() {
    super("Currency must be a three-letter ISO 4217 code");
    this.name = "InvalidCurrencyCodeError";
  }
}

export class InvalidOnboardingChannelError extends SupplierValidationError {
  constructor() {
    super('Onboarding channel must be "web", "api", or "assisted"');
    this.name = "InvalidOnboardingChannelError";
  }
}

export class InvalidWebsiteDomainError extends SupplierValidationError {
  constructor() {
    super("Website domain must be a plausible domain name");
    this.name = "InvalidWebsiteDomainError";
  }
}

const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
const CURRENCY_CODE_RE = /^[A-Z]{3}$/;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const ONBOARDING_CHANNELS: readonly OnboardingChannel[] = ["web", "api", "assisted"];

function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

function assertCountryCode(value: string, field: string): string {
  const normalized = normalizeCountryCode(value);
  if (!COUNTRY_CODE_RE.test(normalized)) {
    throw new InvalidCountryCodeError(field);
  }
  return normalized;
}

/**
 * Validates and normalizes a supplier creation request. Throws a
 * SupplierValidationError subtype on the first invalid field; never returns
 * a partially valid result. registrationCountryCode/operatingCountryCodes
 * are checked for ISO 3166-1 alpha-2 *shape* only — real-registry
 * verification is explicitly out of scope for this slice.
 */
export function validateCreateSupplierInput(input: CreateSupplierInput): ValidatedCreateSupplierInput {
  const reference = input.reference.trim();
  if (reference.length < 1 || reference.length > 64) {
    throw new InvalidSupplierReferenceError();
  }

  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 200) {
    throw new InvalidSupplierDisplayNameError();
  }

  const registrationCountryCode = assertCountryCode(input.registrationCountryCode, "registrationCountryCode");

  const registrationIdentifier = input.registrationIdentifier.trim();
  if (registrationIdentifier.length < 1 || registrationIdentifier.length > 100) {
    throw new InvalidRegistrationIdentifierError();
  }

  const industryCode = input.industryCode.trim();
  if (industryCode.length < 1 || industryCode.length > 100) {
    throw new InvalidIndustryCodeError();
  }

  if (input.operatingCountryCodes.length === 0) {
    throw new InvalidOperatingCountryCodesError();
  }
  const operatingCountryCodes = input.operatingCountryCodes.map((code) => {
    const normalized = normalizeCountryCode(code);
    if (!COUNTRY_CODE_RE.test(normalized)) {
      throw new InvalidOperatingCountryCodesError();
    }
    return normalized;
  });

  const relationshipPurpose = input.relationshipPurpose.trim();
  if (relationshipPurpose.length < 1 || relationshipPurpose.length > 2000) {
    throw new InvalidRelationshipPurposeError();
  }

  if (
    typeof input.annualExposureMinor !== "number" ||
    !Number.isInteger(input.annualExposureMinor) ||
    input.annualExposureMinor < 0
  ) {
    throw new InvalidAnnualExposureError();
  }

  const annualExposureCurrency = input.annualExposureCurrency.trim().toUpperCase();
  if (!CURRENCY_CODE_RE.test(annualExposureCurrency)) {
    throw new InvalidCurrencyCodeError();
  }

  if (!ONBOARDING_CHANNELS.includes(input.onboardingChannel)) {
    throw new InvalidOnboardingChannelError();
  }

  let websiteDomain: string | null = null;
  const rawDomain = input.websiteDomain?.trim();
  if (rawDomain) {
    const normalizedDomain = rawDomain.toLowerCase();
    if (normalizedDomain.length > 255 || !DOMAIN_RE.test(normalizedDomain)) {
      throw new InvalidWebsiteDomainError();
    }
    websiteDomain = normalizedDomain;
  }

  return {
    reference,
    displayName,
    registrationCountryCode,
    registrationIdentifier,
    industryCode,
    operatingCountryCodes,
    relationshipPurpose,
    annualExposureMinor: input.annualExposureMinor,
    annualExposureCurrency,
    onboardingChannel: input.onboardingChannel,
    websiteDomain,
  };
}
