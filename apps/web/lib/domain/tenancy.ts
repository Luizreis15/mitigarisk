import type { TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260912120100_identity_and_tenancy.sql.
// Capability keys are authoritative; role keys are convenience bundles
// (docs/architecture/PLATFORM-ARCHITECTURE.md). Keep this list in sync with
// the seed in that migration until a generated-types pipeline replaces it.

export const CAPABILITY_KEYS = [
  "platform.manage_tenants",
  "tenant.manage_settings",
  "tenant.manage_members",
  "tenant.view",
  "policy.manage",
  "policy.publish",
  "policy.view",
  "evaluation.run",
  "evaluation.view",
  "case.manage",
  "case.decide",
  "case.view",
  "audit.view",
  "integration.manage",
  "integration.view",
  "notification.manage",
  "notification.view",
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export const ROLE_KEYS = [
  "platform_super_admin",
  "tenant_admin",
  "risk_analyst",
  "operator",
  "auditor",
  "integration_developer",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

// Roles a tenant invitation may grant. platform_super_admin is deliberately
// excluded: it is not tenant-scoped membership at all
// (memberships_role_is_tenant_scoped in
// supabase/migrations/20260912120800_security_and_english_first_hardening.sql),
// and public.invite_member() rejects it independently at the database level.
export const TENANT_ROLE_KEYS = ROLE_KEYS.filter(
  (key): key is Exclude<RoleKey, "platform_super_admin"> => key !== "platform_super_admin",
);

export type TenantRoleKey = (typeof TENANT_ROLE_KEYS)[number];

export function isTenantRoleKey(value: string): value is TenantRoleKey {
  return (TENANT_ROLE_KEYS as readonly string[]).includes(value);
}

export type TenantStatus = "active" | "suspended";

export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export type MembershipStatus = "invited" | "active" | "suspended" | "removed";

export interface Membership {
  id: string;
  tenantId: TenantId;
  userId: UserId;
  roleKey: RoleKey;
  status: MembershipStatus;
  invitedBy: UserId | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipTransitionContext {
  /** The acting user is the membership's own user_id. */
  isSelf: boolean;
  /** The acting user is a platform admin or holds tenant.manage_members for this tenant. */
  isAdmin: boolean;
}

/**
 * Mirrors app.guard_membership_transition() in
 * supabase/migrations/20260913090000_auth_tenant_bootstrap.sql: the only
 * capability-free transition is a member accepting their own invitation
 * (invited -> active); every other transition requires admin authority.
 * This is a pre-check for a clean, early error message only — the database
 * trigger is the real enforcement boundary and is the source of truth if
 * the two ever disagree.
 */
export function canTransitionMembershipStatus(
  from: MembershipStatus,
  to: MembershipStatus,
  context: MembershipTransitionContext,
): boolean {
  if (from === to) return false;
  if (from === "invited" && to === "active") {
    return context.isAdmin || context.isSelf;
  }
  return context.isAdmin;
}

export function isCapabilityKey(value: string): value is CapabilityKey {
  return (CAPABILITY_KEYS as readonly string[]).includes(value);
}

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}
