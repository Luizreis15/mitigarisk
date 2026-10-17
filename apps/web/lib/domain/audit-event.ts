import type { TenantId, UserId } from './ids.ts';

/** One append-only audit_events row as shown in the Access trail. */
export interface AuditEventRow {
  id: string;
  tenantId: TenantId;
  actorId: UserId | null;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string | null;
  correlationId: string | null;
  occurredAt: string;
}
