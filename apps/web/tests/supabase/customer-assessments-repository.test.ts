import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runCustomerAssessment,
  listCustomerAssessments,
  getLatestCustomerAssessment,
  AssessmentCorrelationConflictError,
  CustomerNotFoundForAssessmentError,
  NoPublishedCraPolicyError,
  InvalidAssessmentFactsError,
  CustomerAssessmentWriteError,
  CustomerAssessmentReadError,
} from "../../lib/supabase/customer-assessments-repository.ts";
import { ForbiddenError } from "../../lib/supabase/authorization.ts";
import type { CorrelationId, CustomerId, TenantId, UserId } from "../../lib/domain/ids.ts";

const TENANT_ID = "10000000-0000-0000-0000-000000000004" as TenantId;
const CUSTOMER_ID = "30000000-0000-0000-0000-000000000001" as CustomerId;
const CORRELATION_ID = "e1000000-0000-0000-0000-000000000001" as CorrelationId;
const USER_ID = "00000000-0000-0000-0000-000000000002" as UserId;

const RESULT = {
  overall_score: 0,
  category_scores: { customer: 0, geography: 0, product_payment: 0, channel: 0, transactions: 0 },
  band: "LOW" as const,
  dd_level: "SDD" as const,
  outcome: "PROCEED" as const,
  overrides_hit: [],
  approvals_required: [],
  required_actions: ["IDENTIFY_CUSTOMER"],
  review_months: 36,
  missing_factors: [],
  reason_codes: ["BAND_LOW", "DD_SDD"],
};

const ROW = {
  id: "40000000-0000-0000-0000-000000000001",
  tenant_id: TENANT_ID,
  customer_id: CUSTOMER_ID,
  policy_version_id: "20000000-0000-0000-0000-000000000020",
  facts: { purpose: "ecommerce" },
  result: RESULT,
  overall_score: 0,
  band: "LOW" as const,
  dd_level: "SDD" as const,
  outcome: "PROCEED" as const,
  next_review_due: "2029-09-27",
  correlation_id: CORRELATION_ID,
  input_hash: "abc123",
  assessed_by: USER_ID,
  assessed_at: "2026-09-27T00:00:00.000Z",
  created_at: "2026-09-27T00:00:00.000Z",
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

function fakeSelectClient(result: { data: unknown; error: unknown }) {
  const calls: { eqCalls: Array<[string, unknown]> } = { eqCalls: [] };
  const builder = Object.assign(Promise.resolve(result), {
    select: (_columns: string) => builder,
    eq: (column: string, value: unknown) => {
      calls.eqCalls.push([column, value]);
      return builder;
    },
    order: (_column: string, _opts: unknown) => builder,
    limit: (_n: number) => builder,
    maybeSingle: () => Promise.resolve(result),
  });
  const client = { from: (_table: string) => builder } as unknown as SupabaseClient;
  return { client, calls };
}

void test("runCustomerAssessment calls run_customer_assessment with the raw facts document and no engine output", async () => {
  const { client, calls } = fakeRpcClient({ data: ROW, error: null });
  await runCustomerAssessment(client, {
    tenantId: TENANT_ID,
    customerId: CUSTOMER_ID,
    facts: { purpose: "ecommerce" },
    correlationId: CORRELATION_ID,
  });
  assert.equal(calls.name, "run_customer_assessment");
  const params = calls.params as Record<string, unknown>;
  assert.equal(params.p_tenant_id, TENANT_ID);
  assert.equal(params.p_customer_id, CUSTOMER_ID);
  assert.deepEqual(params.p_facts, { purpose: "ecommerce" });
  assert.equal("p_result" in params, false);
  assert.equal("p_overall_score" in params, false);
});

void test("runCustomerAssessment maps the returned row back to the domain shape", async () => {
  const { client } = fakeRpcClient({ data: ROW, error: null });
  const assessment = await runCustomerAssessment(client, {
    tenantId: TENANT_ID,
    customerId: CUSTOMER_ID,
    facts: {},
    correlationId: CORRELATION_ID,
  });
  assert.equal(assessment.band, "LOW");
  assert.equal(assessment.outcome, "PROCEED");
  assert.deepEqual(assessment.result, RESULT);
});

void test("runCustomerAssessment maps a 23505 error to AssessmentCorrelationConflictError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "23505", message: "conflict" } });
  await assert.rejects(
    () =>
      runCustomerAssessment(client, { tenantId: TENANT_ID, customerId: CUSTOMER_ID, facts: {}, correlationId: CORRELATION_ID }),
    AssessmentCorrelationConflictError,
  );
});

void test("runCustomerAssessment maps a P0002 error to CustomerNotFoundForAssessmentError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "P0002", message: "not found" } });
  await assert.rejects(
    () =>
      runCustomerAssessment(client, { tenantId: TENANT_ID, customerId: CUSTOMER_ID, facts: {}, correlationId: CORRELATION_ID }),
    CustomerNotFoundForAssessmentError,
  );
});

void test("runCustomerAssessment maps a P0003 error to NoPublishedCraPolicyError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "P0003", message: "no policy" } });
  await assert.rejects(
    () =>
      runCustomerAssessment(client, { tenantId: TENANT_ID, customerId: CUSTOMER_ID, facts: {}, correlationId: CORRELATION_ID }),
    NoPublishedCraPolicyError,
  );
});

void test("runCustomerAssessment maps a 22023 error to InvalidAssessmentFactsError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "22023", message: "unknown fact key foo" } });
  await assert.rejects(
    () =>
      runCustomerAssessment(client, { tenantId: TENANT_ID, customerId: CUSTOMER_ID, facts: {}, correlationId: CORRELATION_ID }),
    InvalidAssessmentFactsError,
  );
});

void test("runCustomerAssessment maps a 42501 error to ForbiddenError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "42501", message: "insufficient_privilege" } });
  await assert.rejects(
    () =>
      runCustomerAssessment(client, { tenantId: TENANT_ID, customerId: CUSTOMER_ID, facts: {}, correlationId: CORRELATION_ID }),
    ForbiddenError,
  );
});

void test("runCustomerAssessment maps any other database error to CustomerAssessmentWriteError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "08006", message: "connection failure" } });
  await assert.rejects(
    () =>
      runCustomerAssessment(client, { tenantId: TENANT_ID, customerId: CUSTOMER_ID, facts: {}, correlationId: CORRELATION_ID }),
    CustomerAssessmentWriteError,
  );
});

void test("listCustomerAssessments scopes the lookup to both tenant_id and customer_id", async () => {
  const { client, calls } = fakeSelectClient({ data: [ROW], error: null });
  const result = await listCustomerAssessments(client, TENANT_ID, CUSTOMER_ID);
  assert.deepEqual(calls.eqCalls, [
    ["tenant_id", TENANT_ID],
    ["customer_id", CUSTOMER_ID],
  ]);
  assert.equal(result.length, 1);
});

void test("listCustomerAssessments fails closed with a typed error on a database error", async () => {
  const { client } = fakeSelectClient({ data: null, error: { message: "connection reset" } });
  await assert.rejects(() => listCustomerAssessments(client, TENANT_ID, CUSTOMER_ID), CustomerAssessmentReadError);
});

void test("getLatestCustomerAssessment returns null when none exists", async () => {
  const { client } = fakeSelectClient({ data: null, error: null });
  const result = await getLatestCustomerAssessment(client, TENANT_ID, CUSTOMER_ID);
  assert.equal(result, null);
});
