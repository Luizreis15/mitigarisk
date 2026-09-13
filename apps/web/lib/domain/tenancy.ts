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

export function isCapabilityKey(value: string): value is CapabilityKey {
  return (CAPABILITY_KEYS as readonly string[]).includes(value);
}

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}
