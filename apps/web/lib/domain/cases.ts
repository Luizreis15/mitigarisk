import type { CaseId, EvaluationId, TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260912120400_cases.sql. Evidence and
// decisions are append-only at the database level: correcting a mistake
// means adding a new row, never editing or deleting a prior one.

export type CaseStatus =
  | "open"
  | "in_review"
  | "waiting_evidence"
  | "escalated"
  | "closed";
export type CasePriority = "low" | "normal" | "high" | "urgent";
export type CaseDecisionOutcome = "approve" | "reject" | "escalate" | "request_more_info";

export interface Case {
  id: CaseId;
  tenantId: TenantId;
  evaluationId: EvaluationId | null;
  status: CaseStatus;
  priority: CasePriority;
  assignedTo: UserId | null;
  slaDueAt: string | null;
  openedBy: UserId;
  openedAt: string;
  closedAt: string | null;
  closedBy: UserId | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseEvidence {
  id: string;
  tenantId: TenantId;
  caseId: CaseId;
  kind: string;
  storageRef: string;
  sha256: string;
  uploadedBy: UserId;
  createdAt: string;
}

export interface CaseDecision {
  id: string;
  tenantId: TenantId;
  caseId: CaseId;
  decision: CaseDecisionOutcome;
  rationale: string;
  decidedBy: UserId;
  decidedAt: string;
  createdAt: string;
}
