import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantMembershipOption } from "../domain/tenant-selection.ts";
import type { TenantId, UserId } from "../domain/ids";

// Request-scoped read of the verified caller's own active tenant
// memberships, for TASK-019
// (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md). Uses the
// authenticated anon client passed in by the caller — never a service-role
// client — and relies on memberships_select/tenants_select RLS
// (supabase/migrations/20260912120160_identity_and_tenancy_rls.sql) as
// defense in depth. The explicit `.eq("user_id", userId)` filter below is
// the primary control: a platform admin's RLS grant would otherwise let
// this query see every tenant's memberships, which is more than this
// function may ever return (guardrail: "must not return cross-tenant
// operational data"). Only the minimum tenant metadata needed to label a
// selection choice is selected; suspended tenants are excluded even when
// the membership row itself is active.

export class TenantMembershipReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantMembershipReadError";
  }
}

interface MembershipWithTenantRow {
  tenant_id: string;
  tenants: { id: string; name: string; slug: string; status: string } | null;
}

export async function listActiveTenantMemberships(
  client: SupabaseClient,
  userId: UserId,
): Promise<TenantMembershipOption[]> {
  const { data, error } = await client
    .from("memberships")
    .select("tenant_id, tenants(id, name, slug, status)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new TenantMembershipReadError(`Failed to read active tenant memberships: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as MembershipWithTenantRow[];

  return rows
    .filter((row): row is MembershipWithTenantRow & { tenants: NonNullable<MembershipWithTenantRow["tenants"]> } =>
      row.tenants !== null && row.tenants.status === "active",
    )
    .map((row) => ({
      tenantId: row.tenants.id as TenantId,
      tenantName: row.tenants.name,
      tenantSlug: row.tenants.slug,
    }));
}
