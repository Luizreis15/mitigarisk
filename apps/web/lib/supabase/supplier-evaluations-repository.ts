import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorrelationId, EvaluationId, PolicyVersionId, TenantId, UserId } from "../domain/ids";
import type { Evaluation, EvaluationReasonCode } from "../domain/evaluation";
import type { DecisionBand } from "../domain/policy";
import type { DataQualityStatus } from "../domain/evaluation-data-quality";
import type { EvaluationReason } from "../domain/evaluation-reasons";

// Request-scoped wrapper around public.complete_supplier_evaluation()
// (supabase/migrations/20260914120200_supplier_evaluation.sql), the one
// atomic, capability-checked, audited write path for a completed
// evaluation, plus the read paths for showing a persisted result back.
// Caller's own authenticated client throughout; RLS is the real
// enforcement boundary underneath this RPC and these reads.

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

export interface CompleteSupplierEvaluationInput {
  tenantId: TenantId;
  supplierId: string;
  policyVersionId: PolicyVersionId;
  correlationId: CorrelationId;
  inputHash: string;
  normalizedInput: Record<string, unknown>;
  score: number;
  decisionBand: DecisionBand;
  dataQuality: DataQualityStatus;
  missingRequiredFactorKeys: readonly string[];
  reasons: readonly EvaluationReason[];
}

/**
 * Persists one completed supplier evaluation via
 * public.complete_supplier_evaluation(), which inserts the evaluation and
 * its reason codes atomically, replays an identical prior correlation id,
 * and rejects a reused correlation id whose input differs.
 */
export async function completeSupplierEvaluation(
  client: SupabaseClient,
  input: CompleteSupplierEvaluationInput,
): Promise<Evaluation> {
  const { data, error } = await client.rpc("complete_supplier_evaluation", {
    p_tenant_id: input.tenantId,
    p_supplier_id: input.supplierId,
    p_policy_version_id: input.policyVersionId,
    p_correlation_id: input.correlationId,
    p_input_hash: input.inputHash,
    p_normalized_input: input.normalizedInput,
    p_score: input.score,
    p_decision_band: input.decisionBand,
    p_data_quality: input.dataQuality,
    p_missing_required_factor_keys: input.missingRequiredFactorKeys,
    p_reasons: input.reasons,
  });

  if (error) {
    if (error.code === "23505") {
      throw new EvaluationCorrelationConflictError(input.correlationId);
    }
    if (error.code === "P0002") {
      throw new SupplierNotFoundForEvaluationError(input.supplierId);
    }
    throw new EvaluationWriteError(`Failed to complete supplier evaluation: ${error.message}`);
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
