import type { TenantId, UserId } from "./ids";

// Mirrors supabase/migrations/20260912120500_integrations.sql. Only
// key/secret hashes ever appear here; raw secrets are generated and shown
// once by server-side code and are never part of any domain type.

export type ApiClientStatus = "active" | "revoked";

export interface ApiClient {
  id: string;
  tenantId: TenantId;
  name: string;
  keyId: string;
  scopes: string[];
  status: ApiClientStatus;
  createdBy: UserId;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedBy: UserId | null;
}

export type WebhookEndpointStatus = "active" | "disabled";

export interface WebhookEndpoint {
  id: string;
  tenantId: TenantId;
  url: string;
  status: WebhookEndpointStatus;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "dead_letter";

export interface WebhookDelivery {
  id: string;
  tenantId: TenantId;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  responseCode: number | null;
  createdAt: string;
  updatedAt: string;
}
