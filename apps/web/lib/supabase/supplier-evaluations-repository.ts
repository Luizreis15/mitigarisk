import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorrelationId, EvaluationId, PolicyVersionId, TenantId, UserId } from "../domain/ids";
import type { Evaluation, EvaluationReasonCode } from "../domain/evaluation";
import type { DecisionBand } from "../domain/policy";
import type { DataQualityStatus } from "../domain/evaluation-data-quality";
import { ForbiddenError } from "./authorization.ts";

// Request-scoped wrapper around public.run_supplier_evaluation()
// (supabase/migrations/20260914120200_supplier_evaluation.sql), the one
// atomic, capability-checked, audited evaluation path, plus the read paths
// for showing a persisted result back.
//
// Security correction (post-review, 2026-09-15): this used to send a
// fully computed score/decision_band/data_quality/normalized_input/reasons
// to the RPC, trusting whatever the Server Action had computed — entirely
// forgeable by any other authenticated caller with evaluation.run, since
// no service-role credential exists to distinguish "the real app" from
// any other caller. public.run_supplier_evaluation() now takes only
// identifying references and derives everything else itself, from
// persisted supplier/evidence rows and the tenant's own current published
// policy; this repository function shrank to match — there is no longer
// an "engine output" for a caller to supply or for this function to
// forward.

export class EvaluationReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationReadError";
  }
}

export class EvaluationWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationWriteError";
  }
}

/** Same correlation id was already used for this tenant with different evaluation input; a stable typed conflict, never a silently duplicated evaluation. */
export class EvaluationCorrelationConflictError extends Error {
  constructor(correlationId: CorrelationId) {
    super(`Correlation id ${correlationId} was already used with different evaluation input`);
    this.name = "EvaluationCorrelationConflictError";
  }
}

export class SupplierNotFoundForEvaluationError extends Error {
  constructor(supplierId: string) {
    super(`Supplier ${supplierId} was not found in this tenant`);
    this.name = "SupplierNotFoundForEvaluationError";
  }
}

export class NoPublishedPolicyError extends Error {
  constructor(tenantId: TenantId) {
    super(`Tenant ${tenantId} has no published policy version`);
    this.name = "NoPublishedPolicyError";
  }
}

interface EvaluationRow {
  id: string;
  tenant_id: string;
  supplier_id: string | null;
  policy_version_id: string;
  subject_reference: string;
  input_hash: string;
  normalized_input: Record<string, unknown>;
  score: number | null;
  decision_band: DecisionBand | null;
  data_quality: DataQualityStatus | null;
  missing_required_factor_keys: string[];
  status: Evaluation["status"];
  correlation_id: string;
  actor_id: string | null;
  actor_type: Evaluation["actorType"];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapEvaluationRow(row: EvaluationRow): Evaluation {
  return {
    id: row.id as EvaluationId,
    tenantId: row.tenant_id as TenantId,
    supplierId: row.supplier_id,
    policyVersionId: row.policy_version_id as PolicyVersionId,
    subjectReference: row.subject_reference,
    inputHash: row.input_hash,
    normalizedInput: row.normalized_input,
    score: row.score,
    decisionBand: row.decision_band,
    dataQuality: row.data_quality,
    missingRequiredFactorKeys: row.missing_required_factor_keys ?? [],
    status: row.status,
    correlationId: row.correlation_id as CorrelationId,
    actorId: row.actor_id as UserId | null,
    actorType: row.actor_type,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface RunSupplierEvaluationInput {
  tenantId: TenantId;
  supplierId: string;
  correlationId: CorrelationId;
}

/**
 * Runs one supplier evaluation via public.run_supplier_evaluation(), which
 * re-derives every fact from persisted supplier/evidence rows, looks up
 * the tenant's own current published policy itself, computes the score,
 * recommendation, data quality, and reason codes, and persists atomically
 * — replaying an identical prior correlation id or rejecting a reused one
 * whose underlying data differs. No engine output is sent by this
 * function because none exists to send: the caller supplies only
 * identifying references.
 */
export async function runSupplierEvaluation(
  client: SupabaseClient,
  input: RunSupplierEvaluationInput,
): Promise<Evaluation> {
  const { data, error } = await client.rpc("run_supplier_evaluation", {
    p_tenant_id: input.tenantId,
    p_supplier_id: input.supplierId,
    p_correlation_id: input.correlationId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new EvaluationCorrelationConflictError(input.correlationId);
    }
    if (error.code === "P0002") {
      throw new SupplierNotFoundForEvaluationError(input.supplierId);
    }
    if (error.code === "P0003") {
      throw new NoPublishedPolicyError(input.tenantId);
    }
    if (error.code === "42501") {
      throw new ForbiddenError("evaluation.run", input.tenantId);
    }
    throw new EvaluationWriteError(`Failed to run supplier evaluation: ${error.message}`);
  }

  return mapEvaluationRow(data as EvaluationRow);
}

export async function getLatestSupplierEvaluation(
  client: SupabaseClient,
  tenantId: TenantId,
  supplierId: string,
): Promise<Evaluation | null> {
  const { data, error } = await client
    .from("evaluations")
    .select(
      "id, tenant_id, supplier_id, policy_version_id, subject_reference, input_hash, normalized_input, score, decision_band, data_quality, missing_required_factor_keys, status, correlation_id, actor_id, actor_type, completed_at, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new EvaluationReadError(`Failed to read the supplier's evaluation: ${error.message}`);
  }

  return data ? mapEvaluationRow(data as EvaluationRow) : null;
}

interface EvaluationReasonCodeRow {
  id: string;
  tenant_id: string;
  evaluation_id: string;
  code: string;
  description: string;
  weight_contribution: number | null;
  metadata: Record<string, string | number | boolean>;
  created_at: string;
}

export async function listEvaluationReasonCodes(
  client: SupabaseClient,
  tenantId: TenantId,
  evaluationId: EvaluationId,
): Promise<EvaluationReasonCode[]> {
  const { data, error } = await client
    .from("evaluation_reason_codes")
    .select("id, tenant_id, evaluation_id, code, description, weight_contribution, metadata, created_at")
    .eq("tenant_id", tenantId)
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new EvaluationReadError(`Failed to read evaluation reason codes: ${error.message}`);
  }

  return ((data ?? []) as EvaluationReasonCodeRow[]).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id as TenantId,
    evaluationId: row.evaluation_id as EvaluationId,
    code: row.code,
    description: row.description,
    weightContribution: row.weight_contribution,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}
