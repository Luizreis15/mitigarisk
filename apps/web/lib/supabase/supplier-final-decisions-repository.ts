import type { SupabaseClient } from '@supabase/supabase-js';
import type { CorrelationId, EvaluationId, PolicyVersionId, TenantId, UserId } from '../domain/ids';
import type { SupplierFinalDecision, SupplierFinalDecisionValue } from '../domain/supplier-final-decision';
import { ForbiddenError } from './authorization.ts';

export class SupplierFinalDecisionConflictError extends Error {
  constructor() { super('A conflicting final decision already exists'); this.name = 'SupplierFinalDecisionConflictError'; }
}
export class CompletedSupplierEvaluationNotFoundError extends Error {
  constructor() { super('Completed supplier evaluation was not found'); this.name = 'CompletedSupplierEvaluationNotFoundError'; }
}
export class SupplierFinalDecisionWriteError extends Error {
  constructor(message: string) { super(message); this.name = 'SupplierFinalDecisionWriteError'; }
}
export class SupplierFinalDecisionReadError extends Error {
  constructor(message: string) { super(message); this.name = 'SupplierFinalDecisionReadError'; }
}

interface DecisionRow {
  id: string; tenant_id: string; supplier_id: string; evaluation_id: string;
  policy_version_id: string; decision: SupplierFinalDecisionValue; rationale: string | null;
  correlation_id: string; decided_by: string; decided_at: string; created_at: string;
}

function mapDecision(row: DecisionRow): SupplierFinalDecision {
  return {
    id: row.id, tenantId: row.tenant_id as TenantId, supplierId: row.supplier_id,
    evaluationId: row.evaluation_id as EvaluationId,
    policyVersionId: row.policy_version_id as PolicyVersionId,
    decision: row.decision, rationale: row.rationale,
    correlationId: row.correlation_id as CorrelationId,
    decidedBy: row.decided_by as UserId, decidedAt: row.decided_at, createdAt: row.created_at,
  };
}

export async function canRecordSupplierFinalDecision(client: SupabaseClient, tenantId: TenantId): Promise<boolean> {
  const { data, error } = await client.rpc('can_record_supplier_final_decision', { p_tenant_id: tenantId });
  if (error) throw new SupplierFinalDecisionReadError(`Failed to resolve final-decision authority: ${error.message}`);
  return data === true;
}

export async function recordSupplierFinalDecision(client: SupabaseClient, input: {
  tenantId: TenantId; evaluationId: EvaluationId; decision: SupplierFinalDecisionValue;
  rationale: string | null; correlationId: CorrelationId;
}): Promise<SupplierFinalDecision> {
  const { data, error } = await client.rpc('record_supplier_final_decision', {
    p_tenant_id: input.tenantId, p_evaluation_id: input.evaluationId,
    p_decision: input.decision, p_rationale: input.rationale,
    p_correlation_id: input.correlationId,
  });
  if (error?.code === '42501') throw new ForbiddenError('case.decide', input.tenantId);
  if (error?.code === '22023') throw new SupplierFinalDecisionWriteError('Invalid final decision');
  if (error?.code === '22001') throw new SupplierFinalDecisionWriteError('Invalid final decision rationale');
  if (error?.code === 'P0002') throw new CompletedSupplierEvaluationNotFoundError();
  if (error?.code === '23505') throw new SupplierFinalDecisionConflictError();
  if (error) throw new SupplierFinalDecisionWriteError(`Failed to record final decision: ${error.message}`);
  return mapDecision(data as DecisionRow);
}

export async function getSupplierFinalDecision(client: SupabaseClient, tenantId: TenantId, evaluationId: EvaluationId): Promise<SupplierFinalDecision | null> {
  const { data, error } = await client.from('supplier_final_decisions')
    .select('id, tenant_id, supplier_id, evaluation_id, policy_version_id, decision, rationale, correlation_id, decided_by, decided_at, created_at')
    .eq('tenant_id', tenantId).eq('evaluation_id', evaluationId).maybeSingle();
  if (error) throw new SupplierFinalDecisionReadError(`Failed to read final decision: ${error.message}`);
  return data ? mapDecision(data as DecisionRow) : null;
}
