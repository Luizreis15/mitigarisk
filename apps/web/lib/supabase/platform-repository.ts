import type { SupabaseClient } from '@supabase/supabase-js';

// Platform console reads and writes (supabase/migrations/20261124100000_platform_console.sql).
// Every RPC is authorized in the database (platform governance actor only);
// none of them returns tenant-operational data.

export class PlatformForbiddenError extends Error {
  constructor() {
    super('Platform administrator required.');
    this.name = 'PlatformForbiddenError';
  }
}
export class PlatformNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformNotFoundError';
  }
}
export class PlatformConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformConflictError';
  }
}
export class PlatformInvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformInvalidInputError';
  }
}
export class PlatformRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformRequestError';
  }
}

function raise(error: { code?: string; message: string }): never {
  if (error.code === '42501') throw new PlatformForbiddenError();
  if (error.code === 'P0002') throw new PlatformNotFoundError(error.message);
  if (error.code === '23505') throw new PlatformConflictError(error.message);
  if (error.code === '22023' || error.code === '22001') throw new PlatformInvalidInputError(error.message);
  throw new PlatformRequestError(error.message);
}

export type TenantStatus = 'active' | 'suspended';

export interface PlatformTenantRow {
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  activeMembers: number;
  invitedMembers: number;
  suspendedMembers: number;
  adminEmails: string[];
}

export interface PlatformMemberRow {
  membershipId: string;
  userId: string;
  email: string;
  roleKey: string;
  status: string;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface PlatformEventRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export async function listPlatformTenants(client: SupabaseClient): Promise<PlatformTenantRow[]> {
  const { data, error } = await client.rpc('platform_tenant_overview');
  if (error) raise(error);
  return (data as Array<Record<string, unknown>>).map((row) => ({
    tenantId: String(row.tenant_id),
    name: String(row.name),
    slug: String(row.slug),
    status: String(row.status),
    createdAt: String(row.created_at),
    activeMembers: Number(row.active_members),
    invitedMembers: Number(row.invited_members),
    suspendedMembers: Number(row.suspended_members),
    adminEmails: (row.admin_emails as string[] | null) ?? [],
  }));
}

export async function listPlatformTenantMembers(client: SupabaseClient, tenantId: string): Promise<PlatformMemberRow[]> {
  const { data, error } = await client.rpc('platform_tenant_members', { p_tenant_id: tenantId });
  if (error) raise(error);
  return (data as Array<Record<string, unknown>>).map((row) => ({
    membershipId: String(row.membership_id),
    userId: String(row.user_id),
    email: String(row.email),
    roleKey: String(row.role_key),
    status: String(row.status),
    createdAt: String(row.created_at),
    lastSignInAt: (row.last_sign_in_at as string | null) ?? null,
  }));
}

/** Platform-level audit events (tenant_id is null): the only audit rows a platform admin can read. */
export async function listPlatformEvents(client: SupabaseClient, limit = 20): Promise<PlatformEventRow[]> {
  const { data, error } = await client
    .from('audit_events')
    .select('id, action, target_type, target_id, metadata, occurred_at')
    .is('tenant_id', null)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) raise(error);
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    action: String(row.action),
    targetType: String(row.target_type),
    targetId: (row.target_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    occurredAt: String(row.occurred_at),
  }));
}

export async function createPlatformTenant(
  client: SupabaseClient,
  input: { name: string; slug: string; adminEmail: string },
): Promise<{ tenantId: string }> {
  const { data, error } = await client.rpc('platform_create_tenant', {
    p_name: input.name,
    p_slug: input.slug,
    p_admin_email: input.adminEmail,
  });
  if (error) raise(error);
  return { tenantId: String((data as { id: string }).id) };
}

export async function setPlatformTenantStatus(
  client: SupabaseClient,
  input: { tenantId: string; status: TenantStatus; reason: string },
): Promise<void> {
  const { error } = await client.rpc('platform_set_tenant_status', {
    p_tenant_id: input.tenantId,
    p_status: input.status,
    p_reason: input.reason,
  });
  if (error) raise(error);
}

export async function setPlatformMembershipStatus(
  client: SupabaseClient,
  input: { membershipId: string; status: TenantStatus; reason: string },
): Promise<void> {
  const { error } = await client.rpc('platform_set_membership_status', {
    p_membership_id: input.membershipId,
    p_status: input.status,
    p_reason: input.reason,
  });
  if (error) raise(error);
}
