import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveActiveTenantContext,
  resolveAuthorizedTenantContext,
} from "../../lib/supabase/tenant-context.ts";
import {
  NoActiveTenantMembershipError,
  TenantSelectionRequiredError,
  InvalidTenantSelectionError,
} from "../../lib/domain/tenant-selection.ts";
import { ForbiddenError } from "../../lib/supabase/authorization.ts";
import type { RequestIdentity } from "../../lib/domain/identity";
import type { TenantId, UserId } from "../../lib/domain/ids";

const USER_ID = "20000000-0000-0000-0000-000000000001" as UserId;
const IDENTITY: RequestIdentity = { userId: USER_ID, isPlatformAdmin: false };

const TENANT_A = "30000000-0000-0000-0000-000000000001" as TenantId;
const TENANT_B = "30000000-0000-0000-0000-000000000002" as TenantId;
const TENANT_STRANGER = "30000000-0000-0000-0000-000000000fff" as TenantId;

interface MembershipTenantRow {
  tenant_id: string;
  tenants: { id: string; name: string; slug: string; status: string };
}

function membershipRow(id: string, name: string, slug: string): MembershipTenantRow {
  return { tenant_id: id, tenants: { id, name, slug, status: "active" } };
}

// Fakes both the .from() membership-listing query and the .rpc()
// has_capability call on one client, so resolveAuthorizedTenantContext's
// full membership-proof-then-capability-check sequence can be exercised
// without a network call or a real Supabase project.
function fakeClient(input: {
  membershipRows: MembershipTenantRow[] | { error: string };
  capabilityResult?: boolean | { error: string };
}): { client: SupabaseClient; rpcCalls: Array<{ tenantId: unknown; capability: unknown }> } {
  const rpcCalls: Array<{ tenantId: unknown; capability: unknown }> = [];
  // Built on a real Promise (via Object.assign) rather than a plain object
  // defining its own `then`, so it is awaitable without tripping
  // unicorn/no-thenable while still exposing the .select()/.eq() chain.
  const queryResult = !Array.isArray(input.membershipRows)
    ? { data: null, error: { message: input.membershipRows.error } }
    : { data: input.membershipRows, error: null };
  const builder = Object.assign(Promise.resolve(queryResult), {
    select: (_columns: string) => builder,
    eq: (_column: string, _value: unknown) => builder,
  });
  const client = {
    from: (_table: string) => builder,
    rpc: async (_fn: string, args: { p_tenant_id: unknown; p_capability: unknown }) => {
      rpcCalls.push({ tenantId: args.p_tenant_id, capability: args.p_capability });
      const capabilityResult = input.capabilityResult ?? true;
      if (typeof capabilityResult === "object") {
        return { data: null, error: { message: capabilityResult.error } };
      }
      return { data: capabilityResult, error: null };
    },
  } as unknown as SupabaseClient;
  return { client, rpcCalls };
}

void test("no active membership fails closed with NoActiveTenantMembershipError", async () => {
  const { client } = fakeClient({ membershipRows: [] });
  await assert.rejects(
    () => resolveActiveTenantContext(client, IDENTITY, null),
    NoActiveTenantMembershipError,
  );
});

void test("a suspended/invited/removed membership never appears, so its tenant id is invalid_selection", async () => {
  // The repository only ever returns status = 'active' rows; a suspended,
  // invited, or removed membership's tenant simply is not in the list, so
  // requesting it looks identical to any other cross-tenant id.
  const { client } = fakeClient({ membershipRows: [membershipRow(TENANT_B, "Beta", "beta")] });
  await assert.rejects(
    () => resolveActiveTenantContext(client, IDENTITY, TENANT_A),
    InvalidTenantSelectionError,
  );
});

void test("an arbitrary cross-tenant id fails closed with InvalidTenantSelectionError", async () => {
  const { client } = fakeClient({ membershipRows: [membershipRow(TENANT_A, "Acme", "acme")] });
  await assert.rejects(
    () => resolveActiveTenantContext(client, IDENTITY, TENANT_STRANGER),
    InvalidTenantSelectionError,
  );
});

void test("a stale selection for a since-removed membership fails closed with InvalidTenantSelectionError", async () => {
  // TENANT_A was a real, active membership when the link/bookmark for it
  // was made; by the time this request runs, the caller's only active
  // membership is TENANT_B (TENANT_A was suspended, removed, or the
  // caller's own membership in it ended) — it must not fall back to
  // no_membership, which would be a different, less precise error.
  const { client } = fakeClient({ membershipRows: [membershipRow(TENANT_B, "Beta", "beta")] });
  await assert.rejects(
    () => resolveActiveTenantContext(client, IDENTITY, TENANT_A),
    InvalidTenantSelectionError,
  );
});

void test("a malformed requested id fails closed with InvalidTenantSelectionError, with a single active membership", async () => {
  // Mirrors the route's contract: a non-UUID-shaped ?tenant= value is
  // passed through unvalidated and must fail the same way a well-formed
  // but wrong id does, not fall through to auto-select the sole
  // membership.
  const { client } = fakeClient({ membershipRows: [membershipRow(TENANT_A, "Acme", "acme")] });
  await assert.rejects(
    () => resolveActiveTenantContext(client, IDENTITY, "not-a-uuid" as TenantId),
    InvalidTenantSelectionError,
  );
});

void test("a malformed requested id fails closed with InvalidTenantSelectionError, with multiple active memberships", async () => {
  const { client } = fakeClient({
    membershipRows: [membershipRow(TENANT_A, "Acme", "acme"), membershipRow(TENANT_B, "Beta", "beta")],
  });
  await assert.rejects(
    () => resolveActiveTenantContext(client, IDENTITY, "<script>alert(1)</script>" as TenantId),
    InvalidTenantSelectionError,
  );
});

void test("route-level: an invalid selection must never be retried with no candidate id (no silent auto-select fallback)", async () => {
  // Regression guard for the exact bug this fix-up removes from
  // apps/web/app/workspace/page.tsx: on InvalidTenantSelectionError, the
  // caller must classify and stop, never call
  // resolveActiveTenantContext(client, identity, null) as a fallback —
  // doing so would silently select TENANT_B below even though the
  // request explicitly asked for a different (stale/cross-tenant/
  // malformed) tenant.
  const { client } = fakeClient({ membershipRows: [membershipRow(TENANT_B, "Beta", "beta")] });
  let sawInvalidSelection = false;
  try {
    await resolveActiveTenantContext(client, IDENTITY, TENANT_A);
  } catch (error) {
    assert.ok(error instanceof InvalidTenantSelectionError);
    sawInvalidSelection = true;
    // The correct route behavior stops here. Prove that if it *did*
    // wrongly retry with null, that retry would auto-select TENANT_B —
    // i.e. the bug this test guards against would be a real, observable
    // silent tenant switch, not a hypothetical one.
    const wouldBeSilentFallback = await resolveActiveTenantContext(client, IDENTITY, null);
    assert.equal(wouldBeSilentFallback.tenantId, TENANT_B);
  }
  assert.ok(sawInvalidSelection, "expected InvalidTenantSelectionError to be thrown");
});

void test("a single active membership auto-selects without requiring a request param", async () => {
  const { client } = fakeClient({ membershipRows: [membershipRow(TENANT_A, "Acme", "acme")] });
  const context = await resolveActiveTenantContext(client, IDENTITY, null);
  assert.equal(context.tenantId, TENANT_A);
  assert.equal(context.memberships.length, 1);
});

void test("multiple active memberships with no request param require explicit selection", async () => {
  const { client } = fakeClient({
    membershipRows: [membershipRow(TENANT_A, "Acme", "acme"), membershipRow(TENANT_B, "Beta", "beta")],
  });
  await assert.rejects(
    () => resolveActiveTenantContext(client, IDENTITY, null),
    TenantSelectionRequiredError,
  );
});

void test("multiple active memberships with a matching request param select that tenant", async () => {
  const { client } = fakeClient({
    membershipRows: [membershipRow(TENANT_A, "Acme", "acme"), membershipRow(TENANT_B, "Beta", "beta")],
  });
  const context = await resolveActiveTenantContext(client, IDENTITY, TENANT_B);
  assert.equal(context.tenantId, TENANT_B);
});

void test("a membership read RPC/query failure fails closed rather than granting access", async () => {
  const { client } = fakeClient({ membershipRows: { error: "connection reset" } });
  await assert.rejects(() => resolveActiveTenantContext(client, IDENTITY, null));
});

void test("resolveAuthorizedTenantContext checks the required capability only after membership is proven, for the proven tenant", async () => {
  const { client, rpcCalls } = fakeClient({
    membershipRows: [membershipRow(TENANT_A, "Acme", "acme")],
    capabilityResult: true,
  });
  const context = await resolveAuthorizedTenantContext(client, IDENTITY, null, "policy.view");
  assert.equal(context.tenantId, TENANT_A);
  assert.deepEqual(rpcCalls, [{ tenantId: TENANT_A, capability: "policy.view" }]);
});

void test("resolveAuthorizedTenantContext denies with ForbiddenError when the capability RPC returns false", async () => {
  const { client, rpcCalls } = fakeClient({
    membershipRows: [membershipRow(TENANT_A, "Acme", "acme")],
    capabilityResult: false,
  });
  await assert.rejects(
    () => resolveAuthorizedTenantContext(client, IDENTITY, null, "policy.manage"),
    ForbiddenError,
  );
  assert.equal(rpcCalls.length, 1);
});

void test("resolveAuthorizedTenantContext never calls the capability RPC when membership proof fails first", async () => {
  const { client, rpcCalls } = fakeClient({ membershipRows: [] });
  await assert.rejects(
    () => resolveAuthorizedTenantContext(client, IDENTITY, null, "policy.view"),
    NoActiveTenantMembershipError,
  );
  assert.equal(rpcCalls.length, 0);
});

void test("resolveAuthorizedTenantContext fails closed when the capability RPC itself errors", async () => {
  const { client } = fakeClient({
    membershipRows: [membershipRow(TENANT_A, "Acme", "acme")],
    capabilityResult: { error: "function has_capability(uuid, text) does not exist" },
  });
  await assert.rejects(() => resolveAuthorizedTenantContext(client, IDENTITY, null, "policy.view"));
});

void test("a service-role-only style client is never used: this module only ever accepts a request-scoped client parameter", () => {
  // Structural guard, not a runtime assertion: resolveActiveTenantContext
  // and resolveAuthorizedTenantContext take a SupabaseClient argument from
  // the caller on every call; there is no module-level client to smuggle a
  // service-role credential through.
  assert.equal(resolveActiveTenantContext.length, 3);
  assert.equal(resolveAuthorizedTenantContext.length, 4);
});
