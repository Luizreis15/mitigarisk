'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { TenantId } from '@/lib/domain/ids';
import { acceptInvitation } from '@/lib/supabase/memberships';
import {
  createInvitedAccount,
  findUserForInvitation,
  inviteMemberToTenant,
  isInvitableRole,
} from '@/lib/supabase/invitations-repository';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { getServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { getAuthConfirmUrl } from '@/lib/supabase/site-url';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';

// Access Server Actions: invite a member (company admin) and accept an
// invitation (invitee). The membership write always runs with the caller's
// own session (public.invite_member / public.accept_invitation authorize and
// audit). The service-role client is used for one thing only: creating a
// brand-new account and sending its invite email, and only after the
// caller's tenant.manage_members capability was proven server-side.

export type AccessActionResult =
  | { status: 'error'; code: string; attempt: string; values: Record<string, string> }
  | { status: 'success'; code: 'invited_new' | 'invited_existing'; attempt: string; email: string }
  | null;

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function inviteMemberAction(_previous: AccessActionResult, formData: FormData): Promise<AccessActionResult> {
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) redirect('/workspace');
  const client = await createServerSupabaseClient();

  const requestedTenantId = readFormValue(formData, 'tenantId') as TenantId;
  const email = readFormValue(formData, 'email').trim().toLowerCase();
  const roleKey = readFormValue(formData, 'roleKey');
  const values = { email, roleKey };

  let tenantId: TenantId;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'tenant.manage_members');
    tenantId = context.tenantId;
  } catch (error) {
    if (errorCode(error) === 'ForbiddenError') redirect('/denied');
    return { status: 'error', code: errorCode(error), attempt: randomUUID(), values };
  }

  if (!EMAIL.test(email) || email.length > 254 || !isInvitableRole(roleKey)) {
    return { status: 'error', code: 'InvalidInvitationError', attempt: randomUUID(), values };
  }

  let created = false;
  try {
    let userId = await findUserForInvitation(client, tenantId, email);
    if (!userId) {
      userId = await createInvitedAccount(getServiceRoleSupabaseClient(), email, getAuthConfirmUrl());
      created = true;
    }
    await inviteMemberToTenant(client, { tenantId, userId, roleKey });
  } catch (error) {
    return { status: 'error', code: errorCode(error), attempt: randomUUID(), values };
  }

  // Refresh the team list on the Access page.
  revalidatePath('/workspace/access');
  return { status: 'success', code: created ? 'invited_new' : 'invited_existing', attempt: randomUUID(), email };
}

export async function acceptInvitationAction(formData: FormData): Promise<void> {
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) redirect('/workspace');
  const client = await createServerSupabaseClient();
  const membershipId = readFormValue(formData, 'membershipId');
  const tenantId = readFormValue(formData, 'tenantId');
  try {
    await acceptInvitation(client, identity, membershipId);
  } catch {
    redirect('/workspace');
  }
  redirect(`/workspace?tenant=${tenantId}`);
}
