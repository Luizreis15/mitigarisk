import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveSupplierEvaluationFacts,
  computeSupplierEvaluationInputHash,
} from "../../lib/domain/supplier-evaluation-adapter.ts";
import type { Supplier } from "../../lib/domain/supplier.ts";
import type { SupplierEvidence, EvidenceType, VerificationState } from "../../lib/domain/supplier-evidence.ts";
import type { TenantId, UserId } from "../../lib/domain/ids.ts";

const TENANT_ID = "10000000-0000-0000-0000-000000000001" as TenantId;
const USER_ID = "00000000-0000-0000-0000-000000000002" as UserId;

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "40000000-0000-0000-0000-000000000001",
    tenantId: TENANT_ID,
    reference: "SUP-ATLAS-001",
    displayName: "Atlas Components Ltd.",
    relationshipType: "supplier",
    registrationCountryCode: "MT",
    registrationIdentifier: "C-FICTIONAL-1042",
    industryCode: "industrial_components",
    operatingCountryCodes: ["MT", "IT"],
    relationshipPurpose: "Supply of replacement components for operational equipment.",
    annualExposureMinor: 24_000_000,
    annualExposureCurrency: "EUR",
    onboardingChannel: "assisted",
    websiteDomain: "atlas-components.example",
    status: "draft",
    createdBy: USER_ID,
    updatedBy: USER_ID,
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
    ...overrides,
  };
}

function evidenceEntry(evidenceType: EvidenceType, verificationState: VerificationState): SupplierEvidence {
  return {
    id: `evidence-${evidenceType}`,
    tenantId: TENANT_ID,
    supplierId: "40000000-0000-0000-0000-000000000001",
    evidenceType,
    displayName: `Fictional ${evidenceType}`,
    issuerCountryCode: "MT",
    issueDate: "2026-01-15",
    verificationState,
    digestSha256: "0".repeat(64),
    createdBy: USER_ID,
    updatedBy: USER_ID,
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  };
}

const ALL_EVIDENCE_TYPES: EvidenceType[] = [
  "incorporation_record",
  "ownership_declaration",
  "address_confirmation",
  "bank_account_confirmation",
  "compliance_questionnaire",
];

void test("identity_integrity_risk is 0 when registration country is in the operating footprint and the identifier is plausible", () => {
  const facts = deriveSupplierEvaluationFacts(supplier(), []);
  assert.equal(facts.identity_integrity_risk, 0);
});

void test("identity_integrity_risk is 50 when exactly one identity signal is missing", () => {
  const facts = deriveSupplierEvaluationFacts(supplier({ operatingCountryCodes: ["IT"] }), []);
  assert.equal(facts.identity_integrity_risk, 50);
});

void test("identity_integrity_risk is 100 when both identity signals are missing", () => {
  const facts = deriveSupplierEvaluationFacts(
    supplier({ operatingCountryCodes: ["IT"], registrationIdentifier: "AB" }),
    [],
  );
  assert.equal(facts.identity_integrity_risk, 100);
});

void test("geographic_risk scales with the number of distinct operating countries", () => {
  assert.equal(deriveSupplierEvaluationFacts(supplier({ operatingCountryCodes: ["MT"] }), []).geographic_risk, 0);
  assert.equal(deriveSupplierEvaluationFacts(supplier({ operatingCountryCodes: ["MT", "IT"] }), []).geographic_risk, 50);
  assert.equal(
    deriveSupplierEvaluationFacts(supplier({ operatingCountryCodes: ["MT", "IT", "DE"] }), []).geographic_risk,
    100,
  );
});

void test("ownership_transparency_risk reflects the best recorded state of the ownership_declaration evidence", () => {
  assert.equal(deriveSupplierEvaluationFacts(supplier(), []).ownership_transparency_risk, 100);
  assert.equal(
    deriveSupplierEvaluationFacts(supplier(), [evidenceEntry("ownership_declaration", "provided")])
      .ownership_transparency_risk,
    50,
  );
  assert.equal(
    deriveSupplierEvaluationFacts(supplier(), [evidenceEntry("ownership_declaration", "reviewed")])
      .ownership_transparency_risk,
    0,
  );
  assert.equal(
    deriveSupplierEvaluationFacts(supplier(), [evidenceEntry("ownership_declaration", "rejected")])
      .ownership_transparency_risk,
    100,
  );
});

void test("integrity_screening_risk reflects the best recorded state of the compliance_questionnaire evidence", () => {
  assert.equal(deriveSupplierEvaluationFacts(supplier(), []).integrity_screening_risk, 100);
  assert.equal(
    deriveSupplierEvaluationFacts(supplier(), [evidenceEntry("compliance_questionnaire", "reviewed")])
      .integrity_screening_risk,
    0,
  );
});

void test("financial_exposure_risk is 0 at zero exposure and clamps at 100 at or above the configured ceiling", () => {
  assert.equal(deriveSupplierEvaluationFacts(supplier({ annualExposureMinor: 0 }), []).financial_exposure_risk, 0);
  assert.equal(
    deriveSupplierEvaluationFacts(supplier({ annualExposureMinor: 100_000_000 }), []).financial_exposure_risk,
    100,
  );
  assert.equal(
    deriveSupplierEvaluationFacts(supplier({ annualExposureMinor: 500_000_000 }), []).financial_exposure_risk,
    100,
  );
  assert.equal(
    deriveSupplierEvaluationFacts(supplier({ annualExposureMinor: 50_000_000 }), []).financial_exposure_risk,
    50,
  );
});

void test("evidence_quality_risk is 0 when every required evidence type is reviewed", () => {
  const evidence = ALL_EVIDENCE_TYPES.map((type) => evidenceEntry(type, "reviewed"));
  assert.equal(deriveSupplierEvaluationFacts(supplier(), evidence).evidence_quality_risk, 0);
});

void test("evidence_quality_risk is 100 with no evidence recorded", () => {
  assert.equal(deriveSupplierEvaluationFacts(supplier(), []).evidence_quality_risk, 100);
});

void test("evidence_quality_risk stays at least 70 when any required type was rejected, even if others are reviewed", () => {
  const evidence = [
    ...ALL_EVIDENCE_TYPES.slice(1).map((type) => evidenceEntry(type, "reviewed")),
    evidenceEntry(ALL_EVIDENCE_TYPES[0], "rejected"),
  ];
  const risk = deriveSupplierEvaluationFacts(supplier(), evidence).evidence_quality_risk;
  assert.ok(risk >= 70, `expected evidence_quality_risk >= 70 with a rejected required type, got ${risk}`);
});

void test("computeSupplierEvaluationInputHash is deterministic for identical policy/supplier/facts", () => {
  const facts = deriveSupplierEvaluationFacts(supplier(), []);
  const input = { policyVersionId: "20000000-0000-0000-0000-000000000002", supplierId: "40000000-0000-0000-0000-000000000001", facts };
  assert.equal(computeSupplierEvaluationInputHash(input), computeSupplierEvaluationInputHash(input));
});

void test("computeSupplierEvaluationInputHash changes when the derived facts change", () => {
  const base = computeSupplierEvaluationInputHash({
    policyVersionId: "20000000-0000-0000-0000-000000000002",
    supplierId: "40000000-0000-0000-0000-000000000001",
    facts: deriveSupplierEvaluationFacts(supplier(), []),
  });
  const changed = computeSupplierEvaluationInputHash({
    policyVersionId: "20000000-0000-0000-0000-000000000002",
    supplierId: "40000000-0000-0000-0000-000000000001",
    facts: deriveSupplierEvaluationFacts(supplier(), [evidenceEntry("ownership_declaration", "reviewed")]),
  });
  assert.notEqual(base, changed);
});
