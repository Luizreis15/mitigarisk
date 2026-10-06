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
