import type { CorrelationId, TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260912120600_notifications.sql. This models
// the request/delivery-state contract only; no template renders or sends a
// real email anywhere in this task (docs/architecture/PLATFORM-ARCHITECTURE.md,
// "Resend boundary").

export interface NotificationTemplate {
  id: string;
  tenantId: TenantId | null;
  key: string;
  locale: string;
  subject: string;
  body: string;
  createdBy: UserId | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationRequestStatus =
  | "pending"
  | "sent"
  | "failed"
  | "bounced"
  | "complained"
  | "suppressed";

export interface NotificationRequest {
  id: string;
  tenantId: TenantId;
  templateKey: string;
  locale: string;
  recipient: string;
  payload: Record<string, unknown>;
  correlationId: CorrelationId;
  idempotencyKey: string;
  status: NotificationRequestStatus;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}
