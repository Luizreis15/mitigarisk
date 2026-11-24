import type { SupabaseClient } from '@supabase/supabase-js';

import type { TenantId } from '../domain/ids.ts';
import { ForbiddenError } from './authorization.ts';

// Required-action completions and the customer's audit trail
// (supabase/migrations/20261126100000_action_completions_and_audit_pack.sql).

export type ActionSourceType = 'assessment' | 'transaction_check';

export interface ActionCompletion {
  id: string;
  customerId: string;
  sourceType: ActionSourceType;
  sourceId: string;
  actionCode: string;
  evidenceNote: string;
  completedBy: string;
  completedAt: string;
}

export interface CustomerAuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export class ActionCompletionRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionCompletionRejectedError';
  }
}
export class ActionCompletionWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionCompletionWriteError';
  }
}
export class AuditPackReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditPackReadError';
  }
}

interface CompletionRow {
  id: string;
  customer_id: string;
  source_type: ActionSourceType;
  source_id: string;
  action_code: string;
  evidence_note: string;
  completed_by: string;
  completed_at: string;
}

const COLUMNS = 'id, customer_id, source_type, source_id, action_code, evidence_note, completed_by, completed_at';

function mapCompletion(row: CompletionRow): ActionCompletion {
  return {
    id: row.id,
    customerId: row.customer_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    actionCode: row.action_code,
    evidenceNote: row.evidence_note,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
  };
}

export async function listActionCompletions(
  client: SupabaseClient,
  tenantId: string,
  customerId?: string,
): Promise<ActionCompletion[]> {
  let query = client.from('customer_action_completions').select(COLUMNS).eq('tenant_id', tenantId);
  if (customerId) query = query.eq('customer_id', customerId);
  const { data, error } = await query.order('completed_at', { ascending: true });
  if (error) throw new AuditPackReadError(`Failed to list action completions: ${error.message}`);
  return (data as CompletionRow[]).map(mapCompletion);
}

/** Key used to match a completion to the action it closes. */
export function completionKey(sourceType: ActionSourceType, sourceId: string, actionCode: string): string {
  return `${sourceType}:${sourceId}:${actionCode}`;
}

export async function recordActionCompletion(
  client: SupabaseClient,
  input: {
    tenantId: string;
    customerId: string;
    sourceType: ActionSourceType;
    sourceId: string;
    actionCode: string;
    evidenceNote: string;
    correlationId: string;
  },
): Promise<void> {
  const { error } = await client.rpc('record_action_completion', {
    p_tenant_id: input.tenantId,
    p_customer_id: input.customerId,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_action_code: input.actionCode,
    p_evidence_note: input.evidenceNote,
    p_correlation_id: input.correlationId,
  });
  if (error) {
    if (error.code === '42501') throw new ForbiddenError('customer.manage', input.tenantId as TenantId);
    if (['22023', 'P0002', '23505'].includes(error.code)) throw new ActionCompletionRejectedError(error.message);
    throw new ActionCompletionWriteError(`Failed to record action completion: ${error.message}`);
  }
}

/** Audit events about one customer (requires audit.view through RLS). */
export async function listCustomerAuditEvents(
  client: SupabaseClient,
  tenantId: string,
  customerId: string,
): Promise<CustomerAuditEvent[]> {
  const { data, error } = await client
    .from('audit_events')
    .select('id, actor_id, action, target_type, target_id, metadata, occurred_at')
    .eq('tenant_id', tenantId)
    .or(`target_id.eq.${customerId},metadata->>customer_id.eq.${customerId}`)
    .order('occurred_at', { ascending: true });
  if (error) throw new AuditPackReadError(`Failed to list audit events: ${error.message}`);
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    actorId: (row.actor_id as string | null) ?? null,
    action: row.action as string,
    targetType: row.target_type as string,
    targetId: (row.target_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    occurredAt: row.occurred_at as string,
  }));
}

export async function recordAuditPackGenerated(
  client: SupabaseClient,
  input: { tenantId: string; customerId: string; sha256: string },
): Promise<void> {
  const { error } = await client.rpc('record_audit_pack_generated', {
    p_tenant_id: input.tenantId,
    p_customer_id: input.customerId,
    p_sha256: input.sha256,
  });
  if (error) {
    if (error.code === '42501') throw new ForbiddenError('audit.view', input.tenantId as TenantId);
    throw new AuditPackReadError(`Failed to record audit pack generation: ${error.message}`);
  }
}
