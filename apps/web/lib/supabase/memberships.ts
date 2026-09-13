import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestIdentity } from "../domain/identity";
import type { Membership, MembershipStatus, RoleKey, TenantRoleKey } from "../domain/tenancy";
import { isTenantRoleKey } from "../domain/tenancy";
import type { TenantId, UserId } from "../domain/ids";

// Server-only use cases for tenant-admin invitations, self-service invite
// acceptance, and admin-driven membership status changes. Each wraps one of
// the atomic RPCs added in
// supabase/migrations/20260913090000_auth_tenant_bootstrap.sql: every write
// here is capability-checked and audited by the database itself, not by
// this file — these functions add input validation and typed errors only.

export class InvalidTenantRoleError extends Error {
  constructor(roleKey: string) {
    super(`"${roleKey}" cannot be granted through a tenant invitation`);
    this.name = "InvalidTenantRoleError";
  }
}

function mapMembershipRow(row: {
  id: string;
  tenant_id: string;
  user_id: string;
  role_key: string;
  status: string;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}): Membership {
  return {
    id: row.id,
    tenantId: row.tenant_id as TenantId,
    userId: row.user_id as UserId,
    roleKey: row.role_key as RoleKey,
    status: row.status as MembershipStatus,
    invitedBy: row.invited_by as UserId | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface InviteMemberInput {
  tenantId: TenantId;
  inviteeUserId: UserId;
  roleKey: TenantRoleKey;
}

/**
 * Tenant-admin invitation. `identity` is accepted for call-site symmetry
 * with the other use cases in this file, but is not read: invited_by is
 * stamped by public.invite_member() itself from auth.uid(), not from any
 * value this function could pass in.
 */
export async function inviteMember(
  client: SupabaseClient,
  _identity: RequestIdentity,
  input: InviteMemberInput,
): Promise<Membership> {
  if (!isTenantRoleKey(input.roleKey)) {
    throw new InvalidTenantRoleError(input.roleKey);
  }

  const { data, error } = await client.rpc("invite_member", {
    p_tenant_id: input.tenantId,
    p_user_id: input.inviteeUserId,
    p_role_key: input.roleKey,
  });
  if (error) {
    throw new Error(`Failed to invite member: ${error.message}`);
  }

  return mapMembershipRow(data);
}

/**
 * Self-service invite acceptance. The membership id is caller-supplied, but
 * public.accept_invitation() only ever activates a row matching
 * `user_id = auth.uid()` — a caller can attempt this for any id and will
 * simply fail (see AcceptInvitationError) if it is not their own pending
 * invitation.
 */
export class AcceptInvitationError extends Error {
  constructor() {
    super("Invitation not found or already handled");
    this.name = "AcceptInvitationError";
  }
}

export async function acceptInvitation(
  client: SupabaseClient,
  _identity: RequestIdentity,
  membershipId: string,
): Promise<Membership> {
  const { data, error } = await client.rpc("accept_invitation", {
    p_membership_id: membershipId,
  });
  if (error) {
    throw new AcceptInvitationError();
  }

  return mapMembershipRow(data);
}

const ADMIN_SETTABLE_STATUSES = ["active", "suspended", "removed"] as const satisfies readonly MembershipStatus[];
export type AdminSettableMembershipStatus = (typeof ADMIN_SETTABLE_STATUSES)[number];

export class MembershipNotFoundOrForbiddenError extends Error {
  constructor() {
    super("Membership not found or not permitted");
    this.name = "MembershipNotFoundOrForbiddenError";
  }
}

/**
 * Admin-driven status change (suspend, reactivate, or remove a member).
 * Whether the caller may act on this specific membership is decided
 * entirely by RLS and app.guard_membership_transition() on the database
 * side — this function does not re-check tenant.manage_members itself.
 */
export async function setMembershipStatus(
  client: SupabaseClient,
  membershipId: string,
  status: AdminSettableMembershipStatus,
): Promise<Membership> {
  const { data, error } = await client.rpc("set_membership_status", {
    p_membership_id: membershipId,
    p_status: status,
  });
  if (error) {
    throw new MembershipNotFoundOrForbiddenError();
  }

  return mapMembershipRow(data);
}
