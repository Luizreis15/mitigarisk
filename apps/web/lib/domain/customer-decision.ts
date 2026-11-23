import type { CustomerAssessment } from './customer-assessment.ts';

// Human onboarding decisions on a CRA result that requires sign-off
// (supabase/migrations/20261123100000_customer_decisions.sql). MITIGA
// recommends; the MLRO decides, and escalates to the board when needed.

export type CustomerDecisionLevel = 'mlro' | 'board';
export type CustomerDecisionValue = 'approve' | 'reject' | 'escalate';

export interface CustomerDecision {
  id: string;
  tenantId: string;
  customerId: string;
  assessmentId: string;
  level: CustomerDecisionLevel;
  decision: CustomerDecisionValue;
  rationale: string;
  correlationId: string;
  decidedBy: string;
  decidedAt: string;
}

export const DECISION_RATIONALE_MIN = 10;
export const DECISION_RATIONALE_MAX = 1000;

/** Where the human decision on one assessment stands. */
export type DecisionState =
  | 'not_required'
  | 'awaiting_mlro'
  | 'awaiting_board'
  | 'approved'
  | 'rejected';

export interface DecisionStatus {
  state: DecisionState;
  mlro: CustomerDecision | null;
  board: CustomerDecision | null;
  /** The level that decides next, when a decision is pending. */
  pendingLevel: CustomerDecisionLevel | null;
}

export function decisionStatusFor(
  assessment: CustomerAssessment | null,
  decisions: readonly CustomerDecision[],
): DecisionStatus {
  if (!assessment || assessment.outcome !== 'REVIEW_REQUIRED') {
    return { state: 'not_required', mlro: null, board: null, pendingLevel: null };
  }
  const forAssessment = decisions.filter((d) => d.assessmentId === assessment.id);
  const mlro = forAssessment.find((d) => d.level === 'mlro') ?? null;
  const board = forAssessment.find((d) => d.level === 'board') ?? null;

  if (!mlro) return { state: 'awaiting_mlro', mlro, board, pendingLevel: 'mlro' };
  if (mlro.decision === 'escalate') {
    if (!board) return { state: 'awaiting_board', mlro, board, pendingLevel: 'board' };
    return { state: board.decision === 'approve' ? 'approved' : 'rejected', mlro, board, pendingLevel: null };
  }
  return { state: mlro.decision === 'approve' ? 'approved' : 'rejected', mlro, board, pendingLevel: null };
}

/** Decisions the pending level may record: the board cannot escalate again. */
export function allowedDecisions(level: CustomerDecisionLevel | null): CustomerDecisionValue[] {
  if (level === 'mlro') return ['approve', 'reject', 'escalate'];
  if (level === 'board') return ['approve', 'reject'];
  return [];
}

export class InvalidDecisionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDecisionInputError';
  }
}

export function validateDecisionInput(input: { decision: string; rationale: string }): {
  decision: CustomerDecisionValue;
  rationale: string;
} {
  const decision = input.decision;
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'escalate') {
    throw new InvalidDecisionInputError('Choose approve, reject or escalate.');
  }
  const rationale = input.rationale.trim();
  if (rationale.length < DECISION_RATIONALE_MIN) {
    throw new InvalidDecisionInputError('The rationale is too short.');
  }
  if (rationale.length > DECISION_RATIONALE_MAX) {
    throw new InvalidDecisionInputError('The rationale is too long.');
  }
  return { decision, rationale };
}
