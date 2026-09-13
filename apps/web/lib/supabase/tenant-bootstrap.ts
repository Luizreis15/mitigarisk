import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestIdentity } from "../domain/identity";
import type { Tenant } from "../domain/tenancy";
import type { TenantId, UserId } from "../domain/ids";
import { assertValidTenantName, assertValidTenantSlug } from "../domain/tenant-bootstrap";

// Server-only use case: platform-admin tenant creation. Wraps
// public.bootstrap_tenant() (supabase/migrations/20260913090000_auth_tenant_bootstrap.sql),
// which creates the tenant, its first active tenant_admin membership, and an
// audit event in one atomic call — so a partial client-side failure can
// never leave the bootstrap unaudited. Runs through the caller's own
// RLS-respecting client; no service-role key is used or required.

export class NotPlatformAdminError extends Error {
  constructor() {
    super("Only a platform administrator can bootstrap a tenant");
    this.name = "NotPlatformAdminError";
  }
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  /** The user who becomes the tenant's first active tenant_admin. */
  initialAdminUserId: UserId;
}

function mapTenantRow(row: {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
}): Tenant {
  return {
    id: row.id as TenantId,
    name: row.name,
    slug: row.slug,
    status: row.status as Tenant["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTenant(
  client: SupabaseClient,
  identity: RequestIdentity,
  input: CreateTenantInput,
): Promise<Tenant> {
  // Pre-checked here for a clean, typed error before any network call; the
  // database's own check inside bootstrap_tenant() (backed by RLS on
  // public.tenants) is what actually enforces this.
  if (!identity.isPlatformAdmin) {
    throw new NotPlatformAdminError();
  }
  assertValidTenantName(input.name);
  assertValidTenantSlug(input.slug);

  const { data, error } = await client.rpc("bootstrap_tenant", {
    p_name: input.name,
    p_slug: input.slug,
    p_initial_admin_user_id: input.initialAdminUserId,
  });
  if (error) {
    throw new Error(`Failed to bootstrap tenant: ${error.message}`);
  }

  return mapTenantRow(data);
}
