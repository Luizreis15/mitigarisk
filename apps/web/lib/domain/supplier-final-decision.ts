import type { CorrelationId, EvaluationId, PolicyVersionId, TenantId, UserId } from './ids';

export const SUPPLIER_FINAL_DECISIONS = ['approve', 'review', 'reject'] as const;
export type SupplierFinalDecisionValue = (typeof SUPPLIER_FINAL_DECISIONS)[number];

export interface SupplierFinalDecision {
  id: string;
  tenantId: TenantId;
  supplierId: string;
  evaluationId: EvaluationId;
  policyVersionId: PolicyVersionId;
  decision: SupplierFinalDecisionValue;
  rationale: string | null;
  correlationId: CorrelationId;
  decidedBy: UserId;
  decidedAt: string;
  createdAt: string;
}

export class InvalidSupplierFinalDecisionError extends Error {
  constructor() {
    super('Final decision must be approve, review, or reject');
    this.name = 'InvalidSupplierFinalDecisionError';
  }
}

export class InvalidSupplierDecisionRationaleError extends Error {
  constructor() {
    super('Final decision rationale must be no more than 500 characters');
    this.name = 'InvalidSupplierDecisionRationaleError';
  }
}

export function validateSupplierFinalDecision(value: string): SupplierFinalDecisionValue {
  if (!(SUPPLIER_FINAL_DECISIONS as readonly string[]).includes(value)) {
    throw new InvalidSupplierFinalDecisionError();
  }
  return value as SupplierFinalDecisionValue;
}

export function validateSupplierDecisionRationale(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) throw new InvalidSupplierDecisionRationaleError();
  return trimmed;
}
