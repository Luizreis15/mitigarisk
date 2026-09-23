import { createHash } from "node:crypto";
import type { TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260914120100_suppliers.sql
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md, "Initial
// fictional evidence manifest"). Evidence is a tenant-scoped metadata
// manifest only for this slice: no binary upload, no Supabase Storage, and
// no file content of any kind is modeled or hashed here — the digest below
// is computed from declared fictional metadata, never from file bytes.

export const EVIDENCE_TYPES = [
  "incorporation_record",
  "ownership_declaration",
  "address_confirmation",
  "bank_account_confirmation",
  "compliance_questionnaire",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const VERIFICATION_STATES = ["provided", "reviewed", "rejected"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export interface SupplierEvidence {
  id: string;
  tenantId: TenantId;
  supplierId: string;
  evidenceType: EvidenceType;
  displayName: string;
  issuerCountryCode: string | null;
  issueDate: string | null;
  verificationState: VerificationState;
  digestSha256: string;
  createdBy: UserId;
  updatedBy: UserId;
  createdAt: string;
  updatedAt: string;
}

/** Fields a caller may submit to register one evidence entry. Never includes tenantId, supplierId identity beyond the target, or any provenance field. */
export interface CreateSupplierEvidenceInput {
  evidenceType: EvidenceType;
  displayName: string;
  issuerCountryCode?: string | null;
  issueDate?: string | null;
  verificationState: VerificationState;
}

export interface ValidatedCreateSupplierEvidenceInput {
  evidenceType: EvidenceType;
  displayName: string;
  issuerCountryCode: string | null;
  issueDate: string | null;
  verificationState: VerificationState;
  /** SHA-256 hex digest of a canonical declaration built from the fields above; never a raw client-supplied hash. */
  digestSha256: string;
}

export abstract class SupplierEvidenceValidationError extends Error {}

export class InvalidEvidenceTypeError extends SupplierEvidenceValidationError {
  constructor() {
    super(`Evidence type must be one of: ${EVIDENCE_TYPES.join(", ")}`);
    this.name = "InvalidEvidenceTypeError";
  }
}

export class InvalidEvidenceDisplayNameError extends SupplierEvidenceValidationError {
  constructor() {
    super("Evidence display name must be 1-200 characters");
    this.name = "InvalidEvidenceDisplayNameError";
  }
}

export class InvalidEvidenceIssuerCountryCodeError extends SupplierEvidenceValidationError {
  constructor() {
    super("Evidence issuer country code must be a two-letter ISO 3166-1 alpha-2 code");
    this.name = "InvalidEvidenceIssuerCountryCodeError";
  }
}

export class InvalidEvidenceIssueDateError extends SupplierEvidenceValidationError {
  constructor() {
    super("Evidence issue date must be a valid calendar date (YYYY-MM-DD)");
    this.name = "InvalidEvidenceIssueDateError";
  }
}

export class InvalidVerificationStateError extends SupplierEvidenceValidationError {
  constructor() {
    super(`Verification state must be one of: ${VERIFICATION_STATES.join(", ")}`);
    this.name = "InvalidVerificationStateError";
  }
}

const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Computes the fictional test digest for one evidence entry: a SHA-256 hex
 * digest over a canonical string built from the supplier's tenant-unique
 * reference and the entry's own declared, non-secret metadata. Deterministic
 * and pure (no clock, no randomness); the same declared facts always
 * produce the same digest. Never hashes file content — this slice has none.
 */
export function computeEvidenceDigest(
  supplierReference: string,
  input: Pick<ValidatedCreateSupplierEvidenceInput, "evidenceType" | "displayName" | "issuerCountryCode" | "issueDate">,
): string {
  const canonical = [
    supplierReference,
    input.evidenceType,
    input.displayName,
    input.issuerCountryCode ?? "",
    input.issueDate ?? "",
  ].join("|");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Validates and normalizes an evidence registration request, then computes
 * its digest. Throws a SupplierEvidenceValidationError subtype on the first
 * invalid field; never returns a partially valid result.
 */
export function validateCreateSupplierEvidenceInput(
  supplierReference: string,
  input: CreateSupplierEvidenceInput,
): ValidatedCreateSupplierEvidenceInput {
  if (!(EVIDENCE_TYPES as readonly string[]).includes(input.evidenceType)) {
    throw new InvalidEvidenceTypeError();
  }

  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 200) {
    throw new InvalidEvidenceDisplayNameError();
  }

  let issuerCountryCode: string | null = null;
  const rawIssuer = input.issuerCountryCode?.trim();
  if (rawIssuer) {
    const normalized = rawIssuer.toUpperCase();
    if (!COUNTRY_CODE_RE.test(normalized)) {
      throw new InvalidEvidenceIssuerCountryCodeError();
    }
    issuerCountryCode = normalized;
  }

  let issueDate: string | null = null;
  const rawIssueDate = input.issueDate?.trim();
  if (rawIssueDate) {
    if (!isValidCalendarDate(rawIssueDate)) {
      throw new InvalidEvidenceIssueDateError();
    }
    issueDate = rawIssueDate;
  }

  if (!(VERIFICATION_STATES as readonly string[]).includes(input.verificationState)) {
    throw new InvalidVerificationStateError();
  }

  const digestSha256 = computeEvidenceDigest(supplierReference, {
    evidenceType: input.evidenceType,
    displayName,
    issuerCountryCode,
    issueDate,
  });

  return {
    evidenceType: input.evidenceType,
    displayName,
    issuerCountryCode,
    issueDate,
    verificationState: input.verificationState,
    digestSha256,
  };
}
