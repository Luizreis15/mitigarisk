import type { SupabaseClient } from "@supabase/supabase-js";
import type { CapabilityKey } from "../domain/tenancy";
import type { TenantId } from "../domain/ids";

// Thin wrapper around the database's app.has_capability(uuid, text) function
// (supabase/migrations/20260912120000_extensions_and_helpers.sql). Server
// code must call this — or rely on RLS directly — rather than re-implement
// capability logic in TypeScript, so there is exactly one source of truth
// for "who can do what" (docs/architecture/PLATFORM-ARCHITECTURE.md,
// "Permission capabilities are authoritative").
//
// This is a defense-in-depth convenience for early authorization checks
// (e.g. returning 403 before doing any work); it is never a substitute for
// RLS, which still applies to every query regardless of this check's result.

export class ForbiddenError extends Error {
  constructor(capability: CapabilityKey, tenantId: TenantId) {
    super(`Missing capability "${capability}" for tenant ${tenantId}`);
    this.name = "ForbiddenError";
  }
}

export async function hasCapability(
  client: SupabaseClient,
  tenantId: TenantId,
  capability: CapabilityKey,
): Promise<boolean> {
  const { data, error } = await client.rpc("has_capability", {
    p_tenant_id: tenantId,
    p_capability: capability,
  });
  if (error) {
    throw new Error(`has_capability RPC failed: ${error.message}`);
  }
  return data === true;
}

/** Throws ForbiddenError when the current user lacks the capability. */
export async function assertCapability(
  client: SupabaseClient,
  tenantId: TenantId,
  capability: CapabilityKey,
): Promise<void> {
  if (!(await hasCapability(client, tenantId, capability))) {
    throw new ForbiddenError(capability, tenantId);
  }
}
