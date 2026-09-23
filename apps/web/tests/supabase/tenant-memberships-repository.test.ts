import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listActiveTenantMemberships,
  TenantMembershipReadError,
} from "../../lib/supabase/tenant-memberships-repository.ts";
import type { UserId } from "../../lib/domain/ids";

const USER_ID = "20000000-0000-0000-0000-000000000001" as UserId;

// Fakes the chained .from().select().eq().eq() builder shape used by
// listActiveTenantMemberships, and records the filters applied so tests can
// prove the query is scoped to the caller's own user id (the primary
// control, independent of RLS) rather than trusting the query text alone.
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: { eqCalls: Array<[string, unknown]> } = { eqCalls: [] };
  // Built on a real Promise (via Object.assign) rather than a plain object
  // defining its own `then`, so it is awaitable without tripping
  // unicorn/no-thenable while still exposing the .select()/.eq() chain
  // listActiveTenantMemberships calls.
  const builder = Object.assign(Promise.resolve(result), {
    select: (_columns: string) => builder,
    eq: (column: string, value: unknown) => {
      calls.eqCalls.push([column, value]);
      return builder;
    },
  });
  const client = {
    from: (_table: string) => builder,
  } as unknown as SupabaseClient;
  return { client, calls };
}

void test("listActiveTenantMemberships filters by the caller's own user id and status active", async () => {
  const { client, calls } = fakeClient({ data: [], error: null });
  await listActiveTenantMemberships(client, USER_ID);
  assert.deepEqual(calls.eqCalls, [
    ["user_id", USER_ID],
    ["status", "active"],
  ]);
});

void test("listActiveTenantMemberships maps rows to minimum tenant metadata", async () => {
  const { client } = fakeClient({
    data: [
      {
        tenant_id: "30000000-0000-0000-0000-000000000001",
        tenants: {
          id: "30000000-0000-0000-0000-000000000001",
          name: "Acme",
          slug: "acme",
          status: "active",
        },
      },
    ],
    error: null,
  });
  const result = await listActiveTenantMemberships(client, USER_ID);
  assert.deepEqual(result, [
    { tenantId: "30000000-0000-0000-0000-000000000001", tenantName: "Acme", tenantSlug: "acme" },
  ]);
});

void test("listActiveTenantMemberships excludes a suspended tenant even when the membership row is active", async () => {
  const { client } = fakeClient({
    data: [
      {
        tenant_id: "30000000-0000-0000-0000-000000000002",
        tenants: {
          id: "30000000-0000-0000-0000-000000000002",
          name: "Suspended Co",
          slug: "suspended-co",
          status: "suspended",
        },
      },
    ],
    error: null,
  });
  const result = await listActiveTenantMemberships(client, USER_ID);
  assert.deepEqual(result, []);
});

void test("listActiveTenantMemberships excludes a row whose tenant join is missing", async () => {
  const { client } = fakeClient({
    data: [{ tenant_id: "30000000-0000-0000-0000-000000000003", tenants: null }],
    error: null,
  });
  const result = await listActiveTenantMemberships(client, USER_ID);
  assert.deepEqual(result, []);
});

void test("listActiveTenantMemberships fails closed with a typed error on a database error", async () => {
  const { client } = fakeClient({ data: null, error: { message: "connection reset" } });
  await assert.rejects(() => listActiveTenantMemberships(client, USER_ID), TenantMembershipReadError);
});
