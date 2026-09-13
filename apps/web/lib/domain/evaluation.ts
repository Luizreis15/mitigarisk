import type { CorrelationId, EvaluationId, PolicyVersionId, TenantId, UserId } from "./ids";
import type { DecisionBand } from "./policy";

// Mirrors supabase/migrations/20260912120300_evaluation.sql. A completed or
// failed evaluation is immutable evidence at the database level; decision_band
// is always a recommendation, never a final business decision on its own
// (docs/architecture/PLATFORM-ARCHITECTURE.md, "Risk and audit invariants").

export type EvaluationStatus = "pending" | "completed" | "failed";
export type EvaluationActorType = "user" | "service";

export interface Evaluation {
  id: EvaluationId;
  tenantId: TenantId;
  policyVersionId: PolicyVersionId;
  subjectReference: string;
  inputHash: string;
  normalizedInput: Record<string, unknown>;
  score: number | null;
  decisionBand: DecisionBand | null;
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
  createdAt: string;
}

export function isEvaluationImmutable(evaluation: Pick<Evaluation, "status">): boolean {
  return evaluation.status === "completed" || evaluation.status === "failed";
}
