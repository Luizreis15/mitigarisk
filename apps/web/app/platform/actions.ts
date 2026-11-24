'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';

import { isUuid } from '@/lib/domain/ids';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import {
  createPlatformTenant,
  setPlatformMembershipStatus,
  setPlatformTenantStatus,
  type TenantStatus,
} from '@/lib/supabase/platform-repository';

// Platform console Server Actions. Each one requires a platform
// administrator before touching anything; the database re-checks the same
// rule in every RPC (app.assert_platform_governance_actor()).

export type PlatformActionResult =
  | { status: 'error'; code: string; attempt: string; values: Record<string, string> }
  | null;

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

async function requirePlatformAdmin() {
  const identity = await requireAuthenticatedIdentity();
  if (!identity.isPlatformAdmin) redirect('/workspace');
  return createServerSupabaseClient();
}

function readStatus(formData: FormData): TenantStatus | null {
  const status = readFormValue(formData, 'status');
  return status === 'active' || status === 'suspended' ? status : null;
}

export async function createTenantAction(_previous: PlatformActionResult, formData: FormData): Promise<PlatformActionResult> {
  const client = await requirePlatformAdmin();
  const values = {
    name: readFormValue(formData, 'name'),
    slug: readFormValue(formData, 'slug'),
    adminEmail: readFormValue(formData, 'adminEmail'),
  };
  let tenantId: string;
  try {
    ({ tenantId } = await createPlatformTenant(client, values));
  } catch (error) {
    return { status: 'error', code: errorCode(error), attempt: randomUUID(), values };
  }
  redirect(`/platform/tenants/${tenantId}`);
}

export async function setTenantStatusAction(_previous: PlatformActionResult, formData: FormData): Promise<PlatformActionResult> {
  const client = await requirePlatformAdmin();
  const tenantId = readFormValue(formData, 'tenantId');
  const status = readStatus(formData);
  const values = { reason: readFormValue(formData, 'reason') };
  if (!isUuid(tenantId) || !status) {
    return { status: 'error', code: 'PlatformInvalidInputError', attempt: randomUUID(), values };
  }
  try {
    await setPlatformTenantStatus(client, { tenantId, status, reason: values.reason });
  } catch (error) {
    return { status: 'error', code: errorCode(error), attempt: randomUUID(), values };
  }
  redirect(`/platform/tenants/${tenantId}`);
}

export async function setMembershipStatusAction(
  _previous: PlatformActionResult,
  formData: FormData,
): Promise<PlatformActionResult> {
  const client = await requirePlatformAdmin();
  const tenantId = readFormValue(formData, 'tenantId');
  const membershipId = readFormValue(formData, 'membershipId');
  const status = readStatus(formData);
  const values = { reason: readFormValue(formData, 'reason') };
  if (!isUuid(tenantId) || !isUuid(membershipId) || !status) {
    return { status: 'error', code: 'PlatformInvalidInputError', attempt: randomUUID(), values };
  }
  try {
    await setPlatformMembershipStatus(client, { membershipId, status, reason: values.reason });
  } catch (error) {
    return { status: 'error', code: errorCode(error), attempt: randomUUID(), values };
  }
  redirect(`/platform/tenants/${tenantId}`);
}
