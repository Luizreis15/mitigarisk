import type { PolicyVersionId, TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260912120200_risk_policy.sql. Published (and
// archived) versions are immutable at the database level via trigger; the
// types below encode that a caller should never attempt to construct a
// mutation request for a non-draft version in the first place.

export type PolicyVersionStatus = "draft" | "published" | "archived";
export type DecisionBand = "approve" | "review" | "reject";

export interface PolicyVersion {
  id: PolicyVersionId;
  tenantId: TenantId;
  versionNumber: number;
  status: PolicyVersionStatus;
  effectiveFrom: string | null;
  publishedAt: string | null;
  publishedBy: UserId | null;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyFactor {
  id: string;
  tenantId: TenantId;
  policyVersionId: PolicyVersionId;
  key: string;
  label: string;
  weight: number;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface PolicyThreshold {
  id: string;
  tenantId: TenantId;
  policyVersionId: PolicyVersionId;
  label: string;
  minScore: number;
  maxScore: number;
  decisionBand: DecisionBand;
  createdAt: string;
}

/** True only for a version whose factors/thresholds may still be edited. */
export function isEditablePolicyVersion(version: Pick<PolicyVersion, "status">): boolean {
  return version.status === "draft";
}

/**
 * Resolves the decision band for a score against a published version's
 * thresholds. Thresholds must be exhaustive and non-overlapping for a given
 * policy version; that invariant is a policy-authoring concern, not
 * something this pure function can enforce.
 */
export function resolveDecisionBand(
  score: number,
  thresholds: readonly Pick<PolicyThreshold, "minScore" | "maxScore" | "decisionBand">[],
): DecisionBand | null {
  const match = thresholds.find((t) => score >= t.minScore && score <= t.maxScore);
  return match ? match.decisionBand : null;
}
