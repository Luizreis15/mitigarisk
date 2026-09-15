import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completeSupplierEvaluation,
  EvaluationCorrelationConflictError,
  SupplierNotFoundForEvaluationError,
  EvaluationWriteError,
  type CompleteSupplierEvaluationInput,
} from "../../lib/supabase/supplier-evaluations-repository.ts";
import type { CorrelationId, PolicyVersionId, TenantId } from "../../lib/domain/ids.ts";

const TENANT_ID = "10000000-0000-0000-0000-000000000001" as TenantId;
const POLICY_VERSION_ID = "20000000-0000-0000-0000-000000000002" as PolicyVersionId;
const CORRELATION_ID = "50000000-0000-0000-0000-000000000001" as CorrelationId;
const SUPPLIER_ID = "40000000-0000-0000-0000-000000000001";

const INPUT: CompleteSupplierEvaluationInput = {
  tenantId: TENANT_ID,
  supplierId: SUPPLIER_ID,
  policyVersionId: POLICY_VERSION_ID,
  correlationId: CORRELATION_ID,
  inputHash: "a".repeat(64),
  normalizedInput: { identity_integrity_risk: 0 },
  score: 12.5,
  decisionBand: "approve",
  dataQuality: "complete",
  missingRequiredFactorKeys: [],
  reasons: [{ code: "RECOMMENDATION_APPROVE", description: "test", metadata: { score: 12.5 } }],
};

const EVALUATION_ROW = {
  id: "60000000-0000-0000-0000-000000000001",
  tenant_id: TENANT_ID,
  supplier_id: SUPPLIER_ID,
  policy_version_id: POLICY_VERSION_ID,
  subject_reference: "SUP-ATLAS-001",
  input_hash: INPUT.inputHash,
  normalized_input: INPUT.normalizedInput,
  score: 12.5,
  decision_band: "approve" as const,
  data_quality: "complete" as const,
  missing_required_factor_keys: [],
  status: "completed" as const,
  correlation_id: CORRELATION_ID,
  actor_id: "00000000-0000-0000-0000-000000000002",
  actor_type: "user" as const,
  completed_at: "2026-09-14T00:00:00.000Z",
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z",
};

function fakeRpcClient(result: { data: unknown; error: unknown }) {
  const calls: { name?: string; params?: unknown } = {};
  const client = {
    rpc: (name: string, params: unknown) => {
      calls.name = name;
      calls.params = params;
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

void test("completeSupplierEvaluation calls the RPC by name with every field mapped to its p_ parameter", async () => {
  const { client, calls } = fakeRpcClient({ data: EVALUATION_ROW, error: null });
  await completeSupplierEvaluation(client, INPUT);
  assert.equal(calls.name, "complete_supplier_evaluation");
  const params = calls.params as Record<string, unknown>;
  assert.equal(params.p_tenant_id, TENANT_ID);
  assert.equal(params.p_supplier_id, SUPPLIER_ID);
  assert.equal(params.p_policy_version_id, POLICY_VERSION_ID);
  assert.equal(params.p_correlation_id, CORRELATION_ID);
  assert.equal(params.p_score, 12.5);
  assert.equal(params.p_decision_band, "approve");
  assert.equal(params.p_data_quality, "complete");
});

void test("completeSupplierEvaluation maps the returned row back to the domain Evaluation shape", async () => {
  const { client } = fakeRpcClient({ data: EVALUATION_ROW, error: null });
  const evaluation = await completeSupplierEvaluation(client, INPUT);
  assert.equal(evaluation.id, EVALUATION_ROW.id);
  assert.equal(evaluation.status, "completed");
  assert.equal(evaluation.dataQuality, "complete");
  assert.deepEqual(evaluation.missingRequiredFactorKeys, []);
});

void test("completeSupplierEvaluation maps a 23505 error to EvaluationCorrelationConflictError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "23505", message: "conflict" } });
  await assert.rejects(() => completeSupplierEvaluation(client, INPUT), EvaluationCorrelationConflictError);
});

void test("completeSupplierEvaluation maps a P0002 error to SupplierNotFoundForEvaluationError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "P0002", message: "not found" } });
  await assert.rejects(() => completeSupplierEvaluation(client, INPUT), SupplierNotFoundForEvaluationError);
});

void test("completeSupplierEvaluation maps any other error to EvaluationWriteError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "42501", message: "forbidden" } });
  await assert.rejects(() => completeSupplierEvaluation(client, INPUT), EvaluationWriteError);
});
