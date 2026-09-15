import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantId, PolicyVersionId } from "../domain/ids";
import type { PolicyFactorInput, PolicyThresholdInput } from "../domain/evaluation-policy-config";

// Request-scoped read of a tenant's current published policy version and
// its factors/thresholds, in exactly the shape
// apps/web/lib/domain/evaluation-engine.ts already accepts
// (PolicyFactorInput/PolicyThresholdInput — reused, not redefined). Uses the
// caller's own authenticated client; policy_versions/policy_factors/policy_thresholds
// RLS (supabase/migrations/20260912120200_risk_policy.sql) is defense in
// depth on top of the explicit tenant_id filter below.

export class PublishedPolicyReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishedPolicyReadError";
  }
}

export class NoPublishedPolicyError extends Error {
  constructor(tenantId: TenantId) {
    super(`Tenant ${tenantId} has no published policy version`);
    this.name = "NoPublishedPolicyError";
  }
}

export interface PublishedPolicy {
  policyVersionId: PolicyVersionId;
  factors: readonly PolicyFactorInput[];
  thresholds: readonly PolicyThresholdInput[];
}

interface PolicyVersionRow {
  id: string;
}

interface PolicyFactorRow {
  key: string;
  weight: number;
  config: Record<string, unknown>;
}

interface PolicyThresholdRow {
  min_score: number;
  max_score: number;
  decision_band: string;
}

/**
 * Reads the tenant's most recently published policy version, if any, plus
 * its factors and thresholds. Never returns a draft or archived version.
 * Throws NoPublishedPolicyError when the tenant has none — a caller must
 * treat that as "cannot evaluate," never fall back to a different tenant's
 * policy or an unpublished one.
 */
export async function getCurrentPublishedPolicy(
  client: SupabaseClient,
  tenantId: TenantId,
): Promise<PublishedPolicy> {
  const { data: versionRows, error: versionError } = await client
    .from("policy_versions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1);

  if (versionError) {
    throw new PublishedPolicyReadError(`Failed to read published policy version: ${versionError.message}`);
  }

  const version = (versionRows as PolicyVersionRow[] | null)?.[0];
  if (!version) {
    throw new NoPublishedPolicyError(tenantId);
  }

  const policyVersionId = version.id as PolicyVersionId;

  const [{ data: factorRows, error: factorError }, { data: thresholdRows, error: thresholdError }] = await Promise.all([
    client.from("policy_factors").select("key, weight, config").eq("tenant_id", tenantId).eq("policy_version_id", policyVersionId),
    client
      .from("policy_thresholds")
      .select("min_score, max_score, decision_band")
      .eq("tenant_id", tenantId)
      .eq("policy_version_id", policyVersionId),
  ]);

  if (factorError) {
    throw new PublishedPolicyReadError(`Failed to read policy factors: ${factorError.message}`);
  }
  if (thresholdError) {
    throw new PublishedPolicyReadError(`Failed to read policy thresholds: ${thresholdError.message}`);
  }

  const factors: PolicyFactorInput[] = ((factorRows ?? []) as PolicyFactorRow[]).map((row) => ({
    key: row.key,
    weight: row.weight,
    config: row.config,
  }));

  const thresholds: PolicyThresholdInput[] = ((thresholdRows ?? []) as PolicyThresholdRow[]).map((row) => ({
    minScore: row.min_score,
    maxScore: row.max_score,
    decisionBand: row.decision_band as PolicyThresholdInput["decisionBand"],
  }));

  return { policyVersionId, factors, thresholds };
}
