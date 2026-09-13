import type { CorrelationId, TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260912120700_audit.sql. Audit events are
// append-only at the database level; the only client-facing write path is
// the app.record_audit_event() RPC, which stamps actor_id itself.

export type AuditActorType = "user" | "service" | "system";

export interface AuditEvent {
  id: string;
  tenantId: TenantId | null;
  actorId: UserId | null;
  actorType: AuditActorType;
  action: string;
  targetType: string;
  targetId: string | null;
  correlationId: CorrelationId | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface RecordAuditEventInput {
  tenantId: TenantId | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  correlationId?: CorrelationId | null;
  metadata?: Record<string, unknown>;
}
