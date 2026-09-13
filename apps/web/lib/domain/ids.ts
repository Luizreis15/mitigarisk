// Branded identifier types so tenant/user/etc ids cannot be mixed up at
// compile time (e.g. passing a UserId where a TenantId is expected).

declare const brand: unique symbol;
export type Branded<T, B extends string> = T & { readonly [brand]: B };

export type TenantId = Branded<string, "TenantId">;
export type UserId = Branded<string, "UserId">;
export type PolicyVersionId = Branded<string, "PolicyVersionId">;
export type EvaluationId = Branded<string, "EvaluationId">;
export type CaseId = Branded<string, "CaseId">;
export type CorrelationId = Branded<string, "CorrelationId">;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function assertUuid(value: string, label: string): void {
  if (!isUuid(value)) {
    throw new Error(`${label} must be a UUID, got: ${value}`);
  }
}
