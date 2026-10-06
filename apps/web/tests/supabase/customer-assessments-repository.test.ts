import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runCustomerAssessment,
  listCustomerAssessments,
  getLatestCustomerAssessment,
  getCustomerAssessmentForm,
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

const FORM_PAYLOAD = {
  policy_version_id: "20000000-0000-0000-0000-000000000020",
  policy_label: "MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)",
  categories: [
    {
      key: "channel",
      label: "Delivery channel",
      position: 4,
      factors: [{ key: "channel", position: 1, values: ["face_to_face", "non_face_to_face"] }],
    },
  ],
  overrides: [
    { fact_key: "pep_status", values: ["confirmed", "self_declared", "none"], negative_value: "none", provisional: false },
    { fact_key: "hnwi", values: [true, false], negative_value: false, provisional: true },
  ],
};

void test("getCustomerAssessmentForm calls get_customer_assessment_form with only the tenant id", async () => {
  const { client, calls } = fakeRpcClient({ data: FORM_PAYLOAD, error: null });
  await getCustomerAssessmentForm(client, TENANT_ID);
  assert.equal(calls.name, "get_customer_assessment_form");
  assert.deepEqual(calls.params, { p_tenant_id: TENANT_ID });
});

void test("getCustomerAssessmentForm maps the payload to the camelCase domain shape", async () => {
  const { client } = fakeRpcClient({ data: FORM_PAYLOAD, error: null });
  const form = await getCustomerAssessmentForm(client, TENANT_ID);
  assert.deepEqual(form, {
    policyVersionId: "20000000-0000-0000-0000-000000000020",
    policyLabel: "MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)",
    categories: [
      {
        key: "channel",
        label: "Delivery channel",
        position: 4,
        factors: [{ key: "channel", position: 1, values: ["face_to_face", "non_face_to_face"] }],
      },
    ],
    overrides: [
      { factKey: "pep_status", values: ["confirmed", "self_declared", "none"], negativeValue: "none", provisional: false },
      { factKey: "hnwi", values: [true, false], negativeValue: false, provisional: true },
    ],
  });
});

void test("getCustomerAssessmentForm never passes through undocumented fields such as weights or points", async () => {
  const leaky = {
    ...FORM_PAYLOAD,
    weight: 100,
    categories: [
      {
        ...FORM_PAYLOAD.categories[0],
        weight: 10,
        factors: [{ key: "channel", position: 1, values: ["face_to_face"], weight: 100, points: { face_to_face: 0 } }],
      },
    ],
    overrides: [{ ...FORM_PAYLOAD.overrides[0], code: "OVR_PEP", effect: "force_high" }],
  };
  const { client } = fakeRpcClient({ data: leaky, error: null });
  const serialized = JSON.stringify(await getCustomerAssessmentForm(client, TENANT_ID));
  for (const key of ["weight", "points", "code", "effect"]) {
    assert.equal(serialized.includes(`"${key}"`), false, `${key} must not reach the domain shape`);
  }
});

void test("getCustomerAssessmentForm fails closed with CustomerAssessmentReadError on an unexpected payload shape", async () => {
  for (const data of [
    null,
    "form",
    { ...FORM_PAYLOAD, categories: null },
    { ...FORM_PAYLOAD, overrides: [{ fact_key: "hnwi", values: [1], negative_value: false, provisional: false }] },
    { ...FORM_PAYLOAD, overrides: [{ fact_key: "hnwi", values: [true], negative_value: false }] },
    { ...FORM_PAYLOAD, categories: [{ key: "c", label: "C", position: 1, factors: [{ key: "f", position: 1, values: [0] }] }] },
  ]) {
    const { client } = fakeRpcClient({ data, error: null });
    await assert.rejects(() => getCustomerAssessmentForm(client, TENANT_ID), CustomerAssessmentReadError);
  }
});

void test("getCustomerAssessmentForm maps a P0003 error to NoPublishedCraPolicyError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "P0003", message: "no policy" } });
  await assert.rejects(() => getCustomerAssessmentForm(client, TENANT_ID), NoPublishedCraPolicyError);
});

void test("getCustomerAssessmentForm maps a 42501 error to ForbiddenError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "42501", message: "insufficient_privilege" } });
  await assert.rejects(() => getCustomerAssessmentForm(client, TENANT_ID), ForbiddenError);
});

void test("getCustomerAssessmentForm maps any other database error to CustomerAssessmentReadError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "08006", message: "connection failure" } });
  await assert.rejects(() => getCustomerAssessmentForm(client, TENANT_ID), CustomerAssessmentReadError);
});
