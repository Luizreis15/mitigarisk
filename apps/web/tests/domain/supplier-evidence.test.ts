import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeEvidenceDigest,
  validateCreateSupplierEvidenceInput,
  InvalidEvidenceTypeError,
  InvalidEvidenceDisplayNameError,
  InvalidEvidenceIssuerCountryCodeError,
  InvalidEvidenceIssueDateError,
  InvalidVerificationStateError,
  type CreateSupplierEvidenceInput,
} from "../../lib/domain/supplier-evidence.ts";

const SUPPLIER_REFERENCE = "SUP-ATLAS-001";

function complianceInput(overrides: Partial<CreateSupplierEvidenceInput> = {}): CreateSupplierEvidenceInput {
  return {
    evidenceType: "compliance_questionnaire",
    displayName: "Atlas fictional compliance questionnaire",
    issuerCountryCode: "MT",
    issueDate: "2026-01-15",
    verificationState: "reviewed",
    ...overrides,
  };
}

void test("validateCreateSupplierEvidenceInput accepts a valid fictional entry and computes a digest", () => {
  const validated = validateCreateSupplierEvidenceInput(SUPPLIER_REFERENCE, complianceInput());
  assert.equal(validated.evidenceType, "compliance_questionnaire");
  assert.equal(validated.issuerCountryCode, "MT");
  assert.equal(validated.issueDate, "2026-01-15");
  assert.match(validated.digestSha256, /^[0-9a-f]{64}$/);
});

void test("computeEvidenceDigest is deterministic for identical declared facts", () => {
  const facts = {
    evidenceType: "compliance_questionnaire" as const,
    displayName: "Atlas fictional compliance questionnaire",
    issuerCountryCode: "MT",
    issueDate: "2026-01-15",
  };
  assert.equal(computeEvidenceDigest(SUPPLIER_REFERENCE, facts), computeEvidenceDigest(SUPPLIER_REFERENCE, facts));
});

void test("computeEvidenceDigest differs when any declared fact differs", () => {
  const base = computeEvidenceDigest(SUPPLIER_REFERENCE, {
    evidenceType: "compliance_questionnaire",
    displayName: "Atlas fictional compliance questionnaire",
    issuerCountryCode: "MT",
    issueDate: "2026-01-15",
  });
  const changed = computeEvidenceDigest(SUPPLIER_REFERENCE, {
    evidenceType: "compliance_questionnaire",
    displayName: "Atlas fictional compliance questionnaire",
    issuerCountryCode: "IT",
    issueDate: "2026-01-15",
  });
  assert.notEqual(base, changed);
});

void test("validateCreateSupplierEvidenceInput allows optional issuer country and issue date to be absent", () => {
  const validated = validateCreateSupplierEvidenceInput(
    SUPPLIER_REFERENCE,
    complianceInput({ issuerCountryCode: null, issueDate: null }),
  );
  assert.equal(validated.issuerCountryCode, null);
  assert.equal(validated.issueDate, null);
});

void test("validateCreateSupplierEvidenceInput rejects an unsupported evidence type", () => {
  assert.throws(
    () =>
      validateCreateSupplierEvidenceInput(
        SUPPLIER_REFERENCE,
        complianceInput({ evidenceType: "utility_bill" as CreateSupplierEvidenceInput["evidenceType"] }),
      ),
    InvalidEvidenceTypeError,
  );
});

void test("validateCreateSupplierEvidenceInput rejects an empty display name", () => {
  assert.throws(
    () => validateCreateSupplierEvidenceInput(SUPPLIER_REFERENCE, complianceInput({ displayName: "" })),
    InvalidEvidenceDisplayNameError,
  );
});

void test("validateCreateSupplierEvidenceInput rejects a malformed issuer country code", () => {
  assert.throws(
    () => validateCreateSupplierEvidenceInput(SUPPLIER_REFERENCE, complianceInput({ issuerCountryCode: "M" })),
    InvalidEvidenceIssuerCountryCodeError,
  );
});

void test("validateCreateSupplierEvidenceInput rejects an invalid calendar date", () => {
  assert.throws(
    () => validateCreateSupplierEvidenceInput(SUPPLIER_REFERENCE, complianceInput({ issueDate: "2026-02-30" })),
    InvalidEvidenceIssueDateError,
  );
});

void test("validateCreateSupplierEvidenceInput rejects an unsupported verification state", () => {
  assert.throws(
    () =>
      validateCreateSupplierEvidenceInput(
        SUPPLIER_REFERENCE,
        complianceInput({ verificationState: "pending" as CreateSupplierEvidenceInput["verificationState"] }),
      ),
    InvalidVerificationStateError,
  );
});
