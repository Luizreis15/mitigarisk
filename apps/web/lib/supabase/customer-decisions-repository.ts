import type { SupabaseClient } from '@supabase/supabase-js';

import type { CustomerDecision, CustomerDecisionLevel, CustomerDecisionValue } from '../domain/customer-decision.ts';
import type { TenantId } from '../domain/ids.ts';
import { ForbiddenError } from './authorization.ts';

// Reads and the one write path (public.record_customer_decision) for
// customer onboarding decisions. Reads are RLS-scoped to customer.view; the
// write is authorized in the database (case.decide), never here.

export class CustomerDecisionReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerDecisionReadError';
  }
}

export class CustomerDecisionWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerDecisionWriteError';
  }
}

/** Already decided at this level, or the correlation id was reused with other content. */
export class CustomerDecisionConflictError extends Error {
  constructor() {
    super('This assessment already has this decision recorded.');
    this.name = 'CustomerDecisionConflictError';
  }
}

/** A newer assessment exists: the decision must target the latest one. */
export class CustomerDecisionSupersededError extends Error {
  constructor() {
    super('A newer assessment exists for this customer.');
    this.name = 'CustomerDecisionSupersededError';
  }
}

export class CustomerDecisionRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerDecisionRejectedError';
  }
}

interface CustomerDecisionRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  assessment_id: string;
  level: string;
  decision: string;
  rationale: string;
  correlation_id: string;
  decided_by: string;
  decided_at: string;
}

const COLUMNS =
  'id, tenant_id, customer_id, assessment_id, level, decision, rationale, correlation_id, decided_by, decided_at';

function mapRow(row: CustomerDecisionRow): CustomerDecision {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    assessmentId: row.assessment_id,
    level: row.level as CustomerDecisionLevel,
    decision: row.decision as CustomerDecisionValue,
    rationale: row.rationale,
    correlationId: row.correlation_id,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
  };
}

export async function listTenantCustomerDecisions(client: SupabaseClient, tenantId: string): Promise<CustomerDecision[]> {
  const { data, error } = await client
    .from('customer_decisions')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .order('decided_at', { ascending: true });
  if (error) throw new CustomerDecisionReadError(`Failed to list customer decisions: ${error.message}`);
  return (data as CustomerDecisionRow[]).map(mapRow);
}

export async function listCustomerDecisions(
  client: SupabaseClient,
  tenantId: string,
  customerId: string,
): Promise<CustomerDecision[]> {
  const { data, error } = await client
    .from('customer_decisions')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('decided_at', { ascending: true });
  if (error) throw new CustomerDecisionReadError(`Failed to list customer decisions: ${error.message}`);
  return (data as CustomerDecisionRow[]).map(mapRow);
}

export interface RecordCustomerDecisionInput {
  tenantId: string;
  assessmentId: string;
  decision: CustomerDecisionValue;
  rationale: string;
  correlationId: string;
}

export async function recordCustomerDecision(
  client: SupabaseClient,
  input: RecordCustomerDecisionInput,
): Promise<CustomerDecision> {
  const { data, error } = await client.rpc('record_customer_decision', {
    p_tenant_id: input.tenantId,
    p_assessment_id: input.assessmentId,
    p_decision: input.decision,
    p_rationale: input.rationale,
    p_correlation_id: input.correlationId,
  });
  if (error) {
    if (error.code === '42501') throw new ForbiddenError('case.decide', input.tenantId as TenantId);
    if (error.code === '23505') throw new CustomerDecisionConflictError();
    if (error.code === '55000') throw new CustomerDecisionSupersededError();
    if (error.code === '22023' || error.code === '22001' || error.code === 'P0002') {
      throw new CustomerDecisionRejectedError(error.message);
    }
    throw new CustomerDecisionWriteError(`Failed to record customer decision: ${error.message}`);
  }
  return mapRow(data as CustomerDecisionRow);
}
