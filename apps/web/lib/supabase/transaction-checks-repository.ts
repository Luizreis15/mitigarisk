import type { SupabaseClient } from '@supabase/supabase-js';

import type { TransactionCheck, TriggerResult } from '../domain/transaction-check.ts';
import type { TenantId } from '../domain/ids.ts';
import { ForbiddenError } from './authorization.ts';

// Reads and the one write path (public.run_transaction_check) for
// transaction trigger checks. The database computes every result.

export class TransactionCheckReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionCheckReadError';
  }
}
export class TransactionCheckWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionCheckWriteError';
  }
}
export class TransactionCheckRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionCheckRejectedError';
  }
}

interface Row {
  id: string;
  tenant_id: string;
  customer_id: string;
  ruleset_version: string;
  inputs: Record<string, number | boolean | null>;
  result: { results?: TriggerResult[]; hits?: string[]; actions?: string[] };
  hit_count: number;
  checked_by: string;
  checked_at: string;
}

const COLUMNS = 'id, tenant_id, customer_id, ruleset_version, inputs, result, hit_count, checked_by, checked_at';

function mapRow(row: Row): TransactionCheck {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    rulesetVersion: row.ruleset_version,
    inputs: row.inputs,
    results: row.result.results ?? [],
    hits: row.result.hits ?? [],
    actions: row.result.actions ?? [],
    hitCount: row.hit_count,
    checkedBy: row.checked_by,
    checkedAt: row.checked_at,
  };
}

export async function listCustomerTransactionChecks(
  client: SupabaseClient,
  tenantId: string,
  customerId: string,
): Promise<TransactionCheck[]> {
  const { data, error } = await client
    .from('customer_transaction_checks')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('checked_at', { ascending: false })
    .limit(20);
  if (error) throw new TransactionCheckReadError(`Failed to list transaction checks: ${error.message}`);
  return (data as Row[]).map(mapRow);
}

/** Latest check per customer for a tenant (for the work queue). */
export async function listLatestTransactionChecks(client: SupabaseClient, tenantId: string): Promise<Map<string, TransactionCheck>> {
  const { data, error } = await client
    .from('customer_transaction_checks')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .order('checked_at', { ascending: false });
  if (error) throw new TransactionCheckReadError(`Failed to list transaction checks: ${error.message}`);
  const latest = new Map<string, TransactionCheck>();
  for (const row of data as Row[]) {
    if (!latest.has(row.customer_id)) latest.set(row.customer_id, mapRow(row));
  }
  return latest;
}

export async function runTransactionCheck(
  client: SupabaseClient,
  input: { tenantId: string; customerId: string; inputs: Record<string, number | boolean | null>; correlationId: string },
): Promise<TransactionCheck> {
  const { data, error } = await client.rpc('run_transaction_check', {
    p_tenant_id: input.tenantId,
    p_customer_id: input.customerId,
    p_inputs: input.inputs,
    p_correlation_id: input.correlationId,
  });
  if (error) {
    if (error.code === '42501') throw new ForbiddenError('assessment.run', input.tenantId as TenantId);
    if (error.code === '22023' || error.code === 'P0002' || error.code === '23505') {
      throw new TransactionCheckRejectedError(error.message);
    }
    throw new TransactionCheckWriteError(`Failed to run transaction check: ${error.message}`);
  }
  return mapRow(data as Row);
}
