import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditEventRow } from '@/lib/domain/audit-event';
import type { Membership, MembershipStatus, RoleKey } from '@/lib/domain/tenancy';
import type { TenantId, UserId } from '@/lib/domain/ids';

export type { AuditEventRow };

export class AccessReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessReadError';
  }
}

function mapMembership(row: {
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

/** RLS-scoped: members with tenant.view see company memberships; others see only their own row. */
export async function listTenantMemberships(
  client: SupabaseClient,
  tenantId: TenantId,
): Promise<Membership[]> {
  const { data, error } = await client
    .from('memberships')
    .select('id, tenant_id, user_id, role_key, status, invited_by, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AccessReadError(error.message);
  }

  return (data ?? []).map(mapMembership);
}

/** RLS-scoped: requires audit.view on the tenant. Newest first. */
export async function listTenantAuditEvents(
  client: SupabaseClient,
  tenantId: TenantId,
  limit = 40,
): Promise<AuditEventRow[]> {
  const { data, error } = await client
    .from('audit_events')
    .select(
      'id, tenant_id, actor_id, actor_type, action, target_type, target_id, correlation_id, occurred_at',
    )
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AccessReadError(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as TenantId,
    actorId: (row.actor_id as UserId | null) ?? null,
    actorType: row.actor_type as string,
    action: row.action as string,
    targetType: row.target_type as string,
    targetId: (row.target_id as string | null) ?? null,
    correlationId: (row.correlation_id as string | null) ?? null,
    occurredAt: row.occurred_at as string,
  }));
}
