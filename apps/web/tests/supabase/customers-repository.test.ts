import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createCustomer,
  listCustomers,
  getCustomerById,
  DuplicateCustomerReferenceError,
  CustomerWriteError,
  CustomerReadError,
} from "../../lib/supabase/customers-repository.ts";
import { ForbiddenError } from "../../lib/supabase/authorization.ts";
import type { CustomerId, TenantId, UserId } from "../../lib/domain/ids.ts";
import type { ValidatedCreateCustomerInput } from "../../lib/domain/customer.ts";

const TENANT_ID = "10000000-0000-0000-0000-000000000004" as TenantId;
const USER_ID = "00000000-0000-0000-0000-000000000002" as UserId;

const VALIDATED_INPUT: ValidatedCreateCustomerInput = {
  externalReference: "CUST-DEMO-001",
  fullName: "Elena Marchetti",
  dateOfBirth: "1988-04-12",
  countryOfBirth: "IT",
  nationality: "IT",
  residenceCountry: "MT",
  onboardingChannel: "face_to_face",
};

const ROW = {
  id: "30000000-0000-0000-0000-000000000001",
  tenant_id: TENANT_ID,
  external_reference: "CUST-DEMO-001",
  full_name: "Elena Marchetti",
  date_of_birth: "1988-04-12",
  country_of_birth: "IT",
  nationality: "IT",
  residence_country: "MT",
  onboarding_channel: "face_to_face" as const,
  status: "active" as const,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: "2026-09-27T00:00:00.000Z",
  updated_at: "2026-09-27T00:00:00.000Z",
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
    maybeSingle: () => Promise.resolve(result),
  });
  const client = { from: (_table: string) => builder } as unknown as SupabaseClient;
  return { client, calls };
}

void test("createCustomer calls the create_customer RPC with no actor id of any kind", async () => {
  const { client, calls } = fakeRpcClient({ data: ROW, error: null });
  await createCustomer(client, TENANT_ID, VALIDATED_INPUT);
  assert.equal(calls.name, "create_customer");
  const params = calls.params as Record<string, unknown>;
  assert.equal(params.p_tenant_id, TENANT_ID);
  assert.equal(params.p_external_reference, VALIDATED_INPUT.externalReference);
  assert.equal("p_created_by" in params, false);
  assert.equal("actorUserId" in params, false);
});

void test("createCustomer maps a unique-violation to DuplicateCustomerReferenceError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "23505", message: "duplicate key" } });
  await assert.rejects(() => createCustomer(client, TENANT_ID, VALIDATED_INPUT), DuplicateCustomerReferenceError);
});

void test("createCustomer maps a missing-capability error to ForbiddenError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "42501", message: "insufficient_privilege" } });
  await assert.rejects(() => createCustomer(client, TENANT_ID, VALIDATED_INPUT), ForbiddenError);
});

void test("createCustomer maps any other database error to CustomerWriteError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "08006", message: "connection failure" } });
  await assert.rejects(() => createCustomer(client, TENANT_ID, VALIDATED_INPUT), CustomerWriteError);
});

void test("createCustomer maps the returned row back to the domain Customer shape", async () => {
  const { client } = fakeRpcClient({ data: ROW, error: null });
  const customer = await createCustomer(client, TENANT_ID, VALIDATED_INPUT);
  assert.equal(customer.externalReference, "CUST-DEMO-001");
  assert.equal(customer.fullName, "Elena Marchetti");
  assert.equal(customer.status, "active");
});

void test("listCustomers filters by tenant_id", async () => {
  const { client, calls } = fakeSelectClient({ data: [ROW], error: null });
  const result = await listCustomers(client, TENANT_ID);
  assert.deepEqual(calls.eqCalls, [["tenant_id", TENANT_ID]]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, ROW.id);
});

void test("listCustomers fails closed with a typed error on a database error", async () => {
  const { client } = fakeSelectClient({ data: null, error: { message: "connection reset" } });
  await assert.rejects(() => listCustomers(client, TENANT_ID), CustomerReadError);
});

void test("getCustomerById scopes the lookup to both tenant_id and id, and returns null when absent", async () => {
  const { client, calls } = fakeSelectClient({ data: null, error: null });
  const result = await getCustomerById(client, TENANT_ID, "missing-id" as CustomerId);
  assert.deepEqual(calls.eqCalls, [
    ["tenant_id", TENANT_ID],
    ["id", "missing-id"],
  ]);
  assert.equal(result, null);
});
