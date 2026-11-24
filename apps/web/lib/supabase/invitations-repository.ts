import type { SupabaseClient } from '@supabase/supabase-js';

import type { TenantId } from '../domain/ids.ts';
import { ForbiddenError } from './authorization.ts';
import type { DirectoryMember, InvitableRole, PendingInvitation } from '../domain/invitations.ts';

export { INVITABLE_ROLES, isInvitableRole } from '../domain/invitations.ts';
export type { DirectoryMember, InvitableRole, PendingInvitation } from '../domain/invitations.ts';

// Member invitations (supabase/migrations/20261127100000_member_invitations.sql).
// Reads and the membership write run with the signed-in admin's session, so
// authorization and audit stay in the database. Only account creation (and
// its invite email) needs the Supabase admin API: see createInvitedAccount.


export class InvitationRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvitationRejectedError';
  }
}
export class AlreadyMemberError extends Error {
  constructor() {
    super('This person is already a member or invited.');
    this.name = 'AlreadyMemberError';
  }
}
export class InvitationEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvitationEmailError';
  }
}


export async function findUserForInvitation(client: SupabaseClient, tenantId: string, email: string): Promise<string | null> {
  const { data, error } = await client.rpc('find_user_for_invitation', { p_tenant_id: tenantId, p_email: email });
  if (error) {
    if (error.code === '42501') throw new ForbiddenError('tenant.manage_members', tenantId as TenantId);
    throw new InvitationRejectedError(error.message);
  }
  return (data as string | null) ?? null;
}

/**
 * Creates the invitee's account and sends the Supabase invite email
 * (docs/auth/templates/invite.html → /auth/confirm → /update-password).
 * `adminClient` must be the server-only service-role client.
 */
export async function createInvitedAccount(adminClient: SupabaseClient, email: string, redirectTo: string): Promise<string> {
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error || !data.user) throw new InvitationEmailError(error?.message ?? 'No user returned');
  return data.user.id;
}

export async function inviteMemberToTenant(
  client: SupabaseClient,
  input: { tenantId: string; userId: string; roleKey: InvitableRole },
): Promise<void> {
  const { error } = await client.rpc('invite_member', {
    p_tenant_id: input.tenantId,
    p_user_id: input.userId,
    p_role_key: input.roleKey,
  });
  if (error) {
    if (error.code === '42501') throw new ForbiddenError('tenant.manage_members', input.tenantId as TenantId);
    if (error.code === '23505') throw new AlreadyMemberError();
    throw new InvitationRejectedError(error.message);
  }
}

export async function listMyPendingInvitations(client: SupabaseClient): Promise<PendingInvitation[]> {
  const { data, error } = await client.rpc('my_pending_invitations');
  if (error) throw new InvitationRejectedError(error.message);
  return (data as Array<Record<string, string>>).map((row) => ({
    membershipId: row.membership_id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    roleKey: row.role_key,
    invitedAt: row.invited_at,
  }));
}

export async function listTenantMemberDirectory(client: SupabaseClient, tenantId: string): Promise<DirectoryMember[]> {
  const { data, error } = await client.rpc('tenant_member_directory', { p_tenant_id: tenantId });
  if (error) {
    if (error.code === '42501') throw new ForbiddenError('tenant.view', tenantId as TenantId);
    throw new InvitationRejectedError(error.message);
  }
  return (data as Array<Record<string, string>>).map((row) => ({
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    roleKey: row.role_key,
    status: row.status,
    createdAt: row.created_at,
  }));
}
