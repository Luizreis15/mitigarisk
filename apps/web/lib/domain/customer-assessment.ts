import type { CorrelationId, CustomerAssessmentId, CustomerId, PolicyVersionId, TenantId, UserId } from "./ids";
import type { CraResult } from "./cra-engine";

// Mirrors supabase/migrations/20260927100000_customer_assessment.sql
// (docs/tasks/TASK-033-claude-customer-assessment.md). A persisted CRA
// assessment: the exact facts snapshot submitted, the exact
// app.evaluate_cra() output (CraResult), and a few denormalized columns for
// cheap listing. This is a recommendation, never a decision — mirrors
// public.evaluations/public.supplier_final_decisions in that regard.

export interface CustomerAssessment {
  id: CustomerAssessmentId;
  tenantId: TenantId;
  customerId: CustomerId;
  policyVersionId: PolicyVersionId;
  facts: Record<string, unknown>;
  result: CraResult;
  overallScore: number;
  band: CraResult["band"];
  ddLevel: CraResult["dd_level"];
  outcome: CraResult["outcome"];
  nextReviewDue: string;
  correlationId: CorrelationId;
  inputHash: string;
  assessedBy: UserId;
  assessedAt: string;
  createdAt: string;
}

// Mirrors public.get_customer_assessment_form()
// (supabase/migrations/20261006100000_customer_assessment_form.sql,
// docs/tasks/TASK-034-claude-cra-lucimara-decisions-and-assessment-form.md).
// What an assessment needs and which values each fact accepts, for the
// tenant's latest published cra_v2 policy. Deliberately carries no weights
// and no points: a caller who can run an assessment must not be able to
// game the score.

/** An override (screening) fact value: a JSON string or boolean, compared type- and case-sensitively by the database. */
export type CraOverrideFactValue = string | boolean;

export interface CustomerAssessmentFormFactor {
  key: string;
  position: number;
  /** Allowed values (the factor's points-map keys), byte-order sorted. Absent/unknown values are scored as missing data, not rejected. */
  values: string[];
}

export interface CustomerAssessmentFormCategory {
  key: string;
  label: string;
  position: number;
  factors: CustomerAssessmentFormFactor[];
}

export interface CustomerAssessmentFormOverride {
  factKey: string;
  /** Exactly the values run_customer_assessment accepts for this fact; the fact is mandatory. */
  values: CraOverrideFactValue[];
  /** The explicit "no hit" value (false for boolean facts, "none" otherwise). */
  negativeValue: CraOverrideFactValue;
  /** The policy marks this override as pending a compliance decision (e.g. OVR_HNWI, Q6). It is still evaluated. */
  provisional: boolean;
}

export interface CustomerAssessmentForm {
  policyVersionId: PolicyVersionId;
  policyLabel: string;
  categories: CustomerAssessmentFormCategory[];
  overrides: CustomerAssessmentFormOverride[];
}
