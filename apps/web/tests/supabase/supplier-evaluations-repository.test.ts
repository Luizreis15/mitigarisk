import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runSupplierEvaluation,
  EvaluationCorrelationConflictError,
  SupplierNotFoundForEvaluationError,
  NoPublishedPolicyError,
  EvaluationWriteError,
  type RunSupplierEvaluationInput,
} from "../../lib/supabase/supplier-evaluations-repository.ts";
import { ForbiddenError } from "../../lib/supabase/authorization.ts";
import type { CorrelationId, PolicyVersionId, TenantId } from "../../lib/domain/ids.ts";

const TENANT_ID = "10000000-0000-0000-0000-000000000003" as TenantId;
const CORRELATION_ID = "50000000-0000-0000-0000-000000000001" as CorrelationId;
const SUPPLIER_ID = "40000000-0000-0000-0000-000000000001";

const INPUT: RunSupplierEvaluationInput = {
  tenantId: TENANT_ID,
  supplierId: SUPPLIER_ID,
  correlationId: CORRELATION_ID,
};

const EVALUATION_ROW = {
  id: "60000000-0000-0000-0000-000000000001",
  tenant_id: TENANT_ID,
  supplier_id: SUPPLIER_ID,
  policy_version_id: "20000000-0000-0000-0000-000000000010" as PolicyVersionId,
  subject_reference: "SUP-ATLAS-001",
  input_hash: "a".repeat(64),
  normalized_input: { identity_integrity_risk: 0 },
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

void test("runSupplierEvaluation calls run_supplier_evaluation with only identifying references, no engine output", async () => {
  const { client, calls } = fakeRpcClient({ data: EVALUATION_ROW, error: null });
  await runSupplierEvaluation(client, INPUT);
  assert.equal(calls.name, "run_supplier_evaluation");
  const params = calls.params as Record<string, unknown>;
  assert.deepEqual(Object.keys(params).sort(), ["p_correlation_id", "p_supplier_id", "p_tenant_id"]);
  assert.equal(params.p_tenant_id, TENANT_ID);
  assert.equal(params.p_supplier_id, SUPPLIER_ID);
  assert.equal(params.p_correlation_id, CORRELATION_ID);
});

void test("runSupplierEvaluation maps the returned row back to the domain Evaluation shape", async () => {
  const { client } = fakeRpcClient({ data: EVALUATION_ROW, error: null });
  const evaluation = await runSupplierEvaluation(client, INPUT);
  assert.equal(evaluation.id, EVALUATION_ROW.id);
  assert.equal(evaluation.status, "completed");
  assert.equal(evaluation.dataQuality, "complete");
  assert.deepEqual(evaluation.missingRequiredFactorKeys, []);
});

void test("runSupplierEvaluation maps a 23505 error to EvaluationCorrelationConflictError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "23505", message: "conflict" } });
  await assert.rejects(() => runSupplierEvaluation(client, INPUT), EvaluationCorrelationConflictError);
});

void test("runSupplierEvaluation maps a P0002 error to SupplierNotFoundForEvaluationError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "P0002", message: "not found" } });
  await assert.rejects(() => runSupplierEvaluation(client, INPUT), SupplierNotFoundForEvaluationError);
});

void test("runSupplierEvaluation maps a P0003 error to NoPublishedPolicyError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "P0003", message: "no published policy" } });
  await assert.rejects(() => runSupplierEvaluation(client, INPUT), NoPublishedPolicyError);
});

void test("runSupplierEvaluation maps a 42501 error to ForbiddenError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "42501", message: "forbidden" } });
  await assert.rejects(() => runSupplierEvaluation(client, INPUT), ForbiddenError);
});

void test("runSupplierEvaluation maps any other error to EvaluationWriteError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "08006", message: "connection failure" } });
  await assert.rejects(() => runSupplierEvaluation(client, INPUT), EvaluationWriteError);
});
