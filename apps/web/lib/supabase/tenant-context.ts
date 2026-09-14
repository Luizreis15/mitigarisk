import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestIdentity } from "../domain/identity";
import type { CapabilityKey } from "../domain/tenancy";
import type { TenantId } from "../domain/ids";
import {
  resolveTenantSelection,
  NoActiveTenantMembershipError,
  TenantSelectionRequiredError,
  InvalidTenantSelectionError,
  type TenantMembershipOption,
} from "../domain/tenant-selection.ts";
import { listActiveTenantMemberships } from "./tenant-memberships-repository.ts";
import { assertCapability } from "./authorization.ts";

// Fail-closed tenant authorization boundary for TASK-019
// (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md). A
// candidate tenant id (from a query param, form field, etc.) is never
// authorization by itself: it is only ever checked against the memberships
// this module fetches itself, server-side, for the verified caller.

export interface ActiveTenantContext {
  tenantId: TenantId;
  memberships: TenantMembershipOption[];
}

/**
 * Proves the candidate tenant id is one of the caller's own active
 * memberships (or auto-selects the single one, or requires an explicit
 * choice among several). Does not check any capability — this is the
 * membership-proof step that `/workspace`'s landing page uses on its own,
 * since landing on the workspace page requires only active membership, the
 * same as before this task (docs/tasks/TASK-015-claude-real-auth-route-integration.md,
 * docs/tasks/TASK-018-cursor-authenticated-workspace-experience.md). Throws
 * a typed error for every non-success outcome; never returns a tenant id the
 * caller is not an active member of.
 */
export async function resolveActiveTenantContext(
  client: SupabaseClient,
  identity: RequestIdentity,
  requestedTenantId: TenantId | null,
): Promise<ActiveTenantContext> {
  const memberships = await listActiveTenantMemberships(client, identity.userId);
  const outcome = resolveTenantSelection({ activeMemberships: memberships, requestedTenantId });

  switch (outcome.kind) {
    case "no_membership":
      throw new NoActiveTenantMembershipError();
    case "selection_required":
      throw new TenantSelectionRequiredError(outcome.options);
    case "invalid_selection":
      throw new InvalidTenantSelectionError();
    case "auto_selected":
    case "selected":
      return { tenantId: outcome.tenantId, memberships };
  }
}

/**
 * The full boundary: proves active membership as above, then checks the
 * required capability through the existing has_capability RPC
 * (apps/web/lib/supabase/authorization.ts, wrapping
 * supabase/migrations/20260912120000_extensions_and_helpers.sql). This is
 * the reusable primitive for any future route that needs both "is this my
 * tenant" and "am I allowed to do X in it" — `/workspace`'s own landing
 * gate intentionally calls resolveActiveTenantContext alone (see its
 * doc comment) rather than this function, because no existing capability
 * maps to "may land on the generic workspace shell" for every tenant role
 * (tenant.view is granted only to tenant_admin and auditor, not
 * risk_analyst/operator/integration_developer — see
 * supabase/migrations/20260912120100_identity_and_tenancy.sql — and
 * inventing a gate would be a silent product decision this task does not
 * own; tracked by CLA-010 in
 * docs/audits/2026-09-13-claude-architecture-security-audit.md).
 */
export async function resolveAuthorizedTenantContext(
  client: SupabaseClient,
  identity: RequestIdentity,
  requestedTenantId: TenantId | null,
  capability: CapabilityKey,
): Promise<ActiveTenantContext> {
  const context = await resolveActiveTenantContext(client, identity, requestedTenantId);
  await assertCapability(client, context.tenantId, capability);
  return context;
}
