import type { TenantId } from "./ids";

// Pure tenant-selection decision logic for TASK-019
// (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md). Takes only
// values already resolved server-side — a list of the verified caller's own
// active memberships, and a candidate tenant id that is treated as an
// unvalidated value to check, never as authorization by itself
// ("Never trust a tenant ID, role, capability... by itself"). No I/O here:
// apps/web/lib/supabase/tenant-memberships-repository.ts fetches the
// membership list and apps/web/lib/supabase/tenant-context.ts calls this to
// decide what to do with it.

export interface TenantMembershipOption {
  tenantId: TenantId;
  tenantName: string;
  tenantSlug: string;
}

export type TenantSelectionOutcome =
  | { kind: "no_membership" }
  | { kind: "auto_selected"; tenantId: TenantId }
  | { kind: "selection_required"; options: TenantMembershipOption[] }
  | { kind: "selected"; tenantId: TenantId }
  | { kind: "invalid_selection" };

/**
 * Decides what a candidate tenant id (from a query param, form field, etc.)
 * means given the caller's real active memberships. The candidate is never
 * trusted on its own: it is only ever used as a lookup key into
 * `activeMemberships`, which the caller fetched server-side.
 */
export function resolveTenantSelection(input: {
  activeMemberships: TenantMembershipOption[];
  requestedTenantId: TenantId | null;
}): TenantSelectionOutcome {
  const { activeMemberships, requestedTenantId } = input;

  if (activeMemberships.length === 0) {
    return { kind: "no_membership" };
  }

  if (requestedTenantId === null) {
    if (activeMemberships.length === 1) {
      return { kind: "auto_selected", tenantId: activeMemberships[0].tenantId };
    }
    return { kind: "selection_required", options: activeMemberships };
  }

  const match = activeMemberships.find((option) => option.tenantId === requestedTenantId);
  if (!match) {
    return { kind: "invalid_selection" };
  }
  return { kind: "selected", tenantId: match.tenantId };
}

export class NoActiveTenantMembershipError extends Error {
  constructor() {
    super("This account has no active tenant membership");
    this.name = "NoActiveTenantMembershipError";
  }
}

export class TenantSelectionRequiredError extends Error {
  readonly options: TenantMembershipOption[];

  constructor(options: TenantMembershipOption[]) {
    super("Multiple active tenant memberships require an explicit selection");
    this.name = "TenantSelectionRequiredError";
    this.options = options;
  }
}

export class InvalidTenantSelectionError extends Error {
  constructor() {
    super("The requested tenant is not one of this account's active memberships");
    this.name = "InvalidTenantSelectionError";
  }
}

export type TenantSelectionErrorClassification =
  | { kind: "no_membership" }
  | { kind: "selection_required"; options: TenantMembershipOption[] }
  | { kind: "invalid_selection" }
  | { kind: "unknown" };

/**
 * Maps one of this module's typed errors to the flags a route needs to pick
 * a presentation state, without the route re-implementing `instanceof`
 * checks itself. A malformed, stale, or cross-tenant candidate id all reach
 * this the same way — as an InvalidTenantSelectionError thrown by
 * resolveTenantSelection's `!match` branch, since a malformed string simply
 * never equals any real membership's tenant id — so all three collapse to
 * the same "invalid_selection" classification and the same generic,
 * non-disclosing caller response. This must never fall back to a fresh,
 * unrequested lookup (e.g. re-resolving with no candidate id): doing so
 * would silently auto-select a different tenant than the one requested,
 * which is exactly the silent-fallback behavior TASK-019's fix-up removed.
 */
export function classifyTenantSelectionError(error: unknown): TenantSelectionErrorClassification {
  if (error instanceof NoActiveTenantMembershipError) {
    return { kind: "no_membership" };
  }
  if (error instanceof TenantSelectionRequiredError) {
    return { kind: "selection_required", options: error.options };
  }
  if (error instanceof InvalidTenantSelectionError) {
    return { kind: "invalid_selection" };
  }
  return { kind: "unknown" };
}
