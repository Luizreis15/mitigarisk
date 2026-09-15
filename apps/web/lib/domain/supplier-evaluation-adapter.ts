import { createHash } from "node:crypto";
import type { Supplier } from "./supplier";
import type { EvidenceType, SupplierEvidence, VerificationState } from "./supplier-evidence.ts";
import { EVIDENCE_TYPES } from "./supplier-evidence.ts";

// The one adapter this task authorizes between persisted supplier/evidence
// records and the pre-existing, unmodified deterministic evaluation engine
// (apps/web/lib/domain/evaluation-engine.ts). Pure and deterministic: the
// same supplier + evidence rows always derive the same bounded 0-100 facts,
// one per factor key in "Supplier onboarding policy" version 1
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md, "Initial
// policy proposal"). It never accepts a browser-supplied factor score,
// recommendation, or result field — only the two persisted, tenant-scoped
// records a repository already fetched under RLS.
//
// Every factor in that policy is configured with min = 0, max = 100,
// direction = higher_is_riskier (see supabase/seed.sql), so the raw values
// this module returns are already the intended 0-100 risk contribution —
// the engine's own normalization step is then an identity mapping, exactly
// as the task specifies ("The adapter derives these bounded numeric facts
// from the validated supplier and evidence record").
//
// The exact numeric rules below are this task's own documented product
// assumption, not specified by the task contract beyond each factor's
// meaning at 0 and 100: no external company registry, sanctions/PEP/adverse
// media provider, or country risk rating is in scope for this slice (see
// "Out of scope"), and ADR 0002 requires the product to stay market-neutral,
// so geographic_risk is deliberately a footprint-complexity proxy (how many
// distinct operating countries) rather than a per-country risk judgment.
// A future policy-authoring task may replace these with configurable rules;
// this slice hardcodes them here, close to the one policy version that uses
// them, rather than inventing a configuration surface out of scope.

const FINANCIAL_EXPOSURE_CEILING_MINOR_UNITS = 100_000_000;
const MIN_PLAUSIBLE_REGISTRATION_IDENTIFIER_LENGTH = 4;

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** The most favorable (lowest-risk) verification state recorded for a given evidence type, or "missing" if none exists. */
function bestVerificationStateFor(
  evidenceType: EvidenceType,
  evidence: readonly SupplierEvidence[],
): VerificationState | "missing" {
  const entries = evidence.filter((e) => e.evidenceType === evidenceType);
  if (entries.some((e) => e.verificationState === "reviewed")) return "reviewed";
  if (entries.some((e) => e.verificationState === "provided")) return "provided";
  if (entries.some((e) => e.verificationState === "rejected")) return "rejected";
  return "missing";
}

function evidenceTypeRiskScore(state: VerificationState | "missing"): number {
  switch (state) {
    case "reviewed":
      return 0;
    case "provided":
      return 50;
    case "rejected":
    case "missing":
      return 100;
  }
}

function identityIntegrityRisk(supplier: Supplier): number {
  const countryConsistent = supplier.operatingCountryCodes.includes(supplier.registrationCountryCode);
  const identifierPlausible =
    supplier.registrationIdentifier.trim().length >= MIN_PLAUSIBLE_REGISTRATION_IDENTIFIER_LENGTH;

  if (countryConsistent && identifierPlausible) return 0;
  if (countryConsistent || identifierPlausible) return 50;
  return 100;
}

function geographicRisk(supplier: Supplier): number {
  const distinctCount = new Set(supplier.operatingCountryCodes).size;
  if (distinctCount <= 1) return 0;
  if (distinctCount === 2) return 50;
  return 100;
}

function ownershipTransparencyRisk(evidence: readonly SupplierEvidence[]): number {
  return evidenceTypeRiskScore(bestVerificationStateFor("ownership_declaration", evidence));
}

function integrityScreeningRisk(evidence: readonly SupplierEvidence[]): number {
  return evidenceTypeRiskScore(bestVerificationStateFor("compliance_questionnaire", evidence));
}

function financialExposureRisk(supplier: Supplier): number {
  const ratio = supplier.annualExposureMinor / FINANCIAL_EXPOSURE_CEILING_MINOR_UNITS;
  return Math.round(clampScore(ratio * 100));
}

function evidenceQualityRisk(evidence: readonly SupplierEvidence[]): number {
  const states = EVIDENCE_TYPES.map((type) => bestVerificationStateFor(type, evidence));
  const reviewedCount = states.filter((state) => state === "reviewed").length;
  const anyRejected = states.some((state) => state === "rejected");

  const base = 100 - (reviewedCount / EVIDENCE_TYPES.length) * 100;
  return Math.round(anyRejected ? Math.max(base, 70) : base);
}

export interface SupplierEvaluationFacts {
  identity_integrity_risk: number;
  geographic_risk: number;
  ownership_transparency_risk: number;
  integrity_screening_risk: number;
  financial_exposure_risk: number;
  evidence_quality_risk: number;
  // Explicit index signature so this type structurally satisfies
  // EvaluationEngineInput["facts"] (Readonly<Record<string, unknown>>)
  // without a cast, while keeping the six named, checked properties above.
  [key: string]: number;
}

/**
 * Derives the six bounded 0-100 evaluation facts for "Supplier onboarding
 * policy" version 1 from a persisted supplier and its persisted evidence
 * manifest. Pure: no Supabase, network, clock, or random-number dependency.
 */
export function deriveSupplierEvaluationFacts(
  supplier: Supplier,
  evidence: readonly SupplierEvidence[],
): SupplierEvaluationFacts {
  return {
    identity_integrity_risk: identityIntegrityRisk(supplier),
    geographic_risk: geographicRisk(supplier),
    ownership_transparency_risk: ownershipTransparencyRisk(evidence),
    integrity_screening_risk: integrityScreeningRisk(evidence),
    financial_exposure_risk: financialExposureRisk(supplier),
    evidence_quality_risk: evidenceQualityRisk(evidence),
  };
}

/**
 * Deterministic SHA-256 hex digest of exactly what this evaluation run was
 * over: the policy version, the supplier, and the derived facts. Stored as
 * evaluations.input_hash; used to distinguish a genuine idempotent replay
 * (same correlation id, same hash) from a reused correlation id with
 * different input (same correlation id, different hash), which
 * public.complete_supplier_evaluation() rejects as a stable conflict.
 */
export function computeSupplierEvaluationInputHash(input: {
  policyVersionId: string;
  supplierId: string;
  facts: SupplierEvaluationFacts;
}): string {
  const canonical = JSON.stringify({
    policyVersionId: input.policyVersionId,
    supplierId: input.supplierId,
    facts: input.facts,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
