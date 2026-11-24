// Audit pack: everything MITIGA holds about one customer, in a fixed
// order, serialised canonically so its SHA-256 is reproducible. Built only
// from persisted records; nothing is recomputed here.

export interface AuditPackInput {
  generatedAt: string;
  generatedBy: string;
  tenant: { id: string; name: string | null };
  customer: Record<string, unknown>;
  assessments: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  transactionChecks: Array<Record<string, unknown>>;
  actionCompletions: Array<Record<string, unknown>>;
  auditTrail: Array<Record<string, unknown>>;
}

export const AUDIT_PACK_FORMAT = 'mitiga.audit-pack/v1';

const timeOf = (row: Record<string, unknown>, key: string) => (typeof row[key] === 'string' ? (row[key] as string) : '');
const byTime = (key: string) => (a: Record<string, unknown>, b: Record<string, unknown>) =>
  timeOf(a, key).localeCompare(timeOf(b, key));

export function buildAuditPack(input: AuditPackInput) {
  return {
    format: AUDIT_PACK_FORMAT,
    generated_at: input.generatedAt,
    generated_by: input.generatedBy,
    tenant: input.tenant,
    customer: input.customer,
    assessments: [...input.assessments].sort(byTime('assessed_at')),
    decisions: [...input.decisions].sort(byTime('decided_at')),
    transaction_checks: [...input.transactionChecks].sort(byTime('checked_at')),
    action_completions: [...input.actionCompletions].sort(byTime('completed_at')),
    audit_trail: [...input.auditTrail].sort(byTime('occurred_at')),
  };
}

/** JSON with object keys sorted at every level (arrays keep their order). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}
