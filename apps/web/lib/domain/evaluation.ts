import type { CorrelationId, EvaluationId, PolicyVersionId, TenantId, UserId } from "./ids";
import type { DecisionBand } from "./policy";
import type { DataQualityStatus } from "./evaluation-data-quality";

// Mirrors supabase/migrations/20260912120300_evaluation.sql, extended by
// supabase/migrations/20260914120200_supplier_evaluation.sql (TASK-023:
// supplierId, dataQuality, missingRequiredFactorKeys, and reason-code
// metadata). A completed or failed evaluation is immutable evidence at the
// database level; decision_band is always a recommendation, never a final
// business decision on its own (docs/architecture/PLATFORM-ARCHITECTURE.md,
// "Risk and audit invariants").

export type EvaluationStatus = "pending" | "completed" | "failed";
export type EvaluationActorType = "user" | "service";

export interface Evaluation {
  id: EvaluationId;
  tenantId: TenantId;
  /** Nullable: the shared evaluations table may one day score a subject that is not a supplier. Always set for this task's evaluations. */
  supplierId: string | null;
  policyVersionId: PolicyVersionId;
  subjectReference: string;
  inputHash: string;
  normalizedInput: Record<string, unknown>;
  score: number | null;
  decisionBand: DecisionBand | null;
  dataQuality: DataQualityStatus | null;
  missingRequiredFactorKeys: readonly string[];
  status: EvaluationStatus;
  correlationId: CorrelationId;
  actorId: UserId | null;
  actorType: EvaluationActorType;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationReasonCode {
  id: string;
  tenantId: TenantId;
  evaluationId: EvaluationId;
  code: string;
  description: string;
  weightContribution: number | null;
  metadata: Readonly<Record<string, string | number | boolean>>;
  createdAt: string;
}

export function isEvaluationImmutable(evaluation: Pick<Evaluation, "status">): boolean {
  return evaluation.status === "completed" || evaluation.status === "failed";
}
