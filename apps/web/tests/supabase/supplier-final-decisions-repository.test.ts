import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CorrelationId, EvaluationId, TenantId } from '../../lib/domain/ids.ts';
import { recordSupplierFinalDecision, SupplierFinalDecisionConflictError, CompletedSupplierEvaluationNotFoundError } from '../../lib/supabase/supplier-final-decisions-repository.ts';
import { ForbiddenError } from '../../lib/supabase/authorization.ts';

const input = { tenantId: '10000000-0000-0000-0000-000000000003' as TenantId, evaluationId: '60000000-0000-0000-0000-000000000001' as EvaluationId, decision: 'review' as const, rationale: null, correlationId: '70000000-0000-0000-0000-000000000001' as CorrelationId };
function clientFor(result: {data: unknown; error: unknown}) { const calls: Record<string, unknown> = {}; return { calls, client: { rpc(name: string, params: unknown) { calls.name=name; calls.params=params; return Promise.resolve(result); } } as unknown as SupabaseClient }; }

void test('repository sends only identifiers, decision, and rationale to the RPC', async () => {
  const row = { id:'1', tenant_id:input.tenantId, supplier_id:'2', evaluation_id:input.evaluationId, policy_version_id:'3', decision:'review', rationale:null, correlation_id:input.correlationId, decided_by:'4', decided_at:'2026-09-15T00:00:00Z', created_at:'2026-09-15T00:00:00Z' };
  const {client,calls}=clientFor({data:row,error:null}); const result=await recordSupplierFinalDecision(client,input);
  assert.equal(calls.name,'record_supplier_final_decision');
  assert.deepEqual(Object.keys(calls.params as object).sort(), ['p_correlation_id','p_decision','p_evaluation_id','p_rationale','p_tenant_id']);
  assert.equal(result.decision,'review');
});
void test('repository maps authorization, missing evaluation, and conflict errors', async () => {
  await assert.rejects(() => recordSupplierFinalDecision(clientFor({data:null,error:{code:'42501'}}).client,input), ForbiddenError);
  await assert.rejects(() => recordSupplierFinalDecision(clientFor({data:null,error:{code:'P0002'}}).client,input), CompletedSupplierEvaluationNotFoundError);
  await assert.rejects(() => recordSupplierFinalDecision(clientFor({data:null,error:{code:'23505'}}).client,input), SupplierFinalDecisionConflictError);
});
