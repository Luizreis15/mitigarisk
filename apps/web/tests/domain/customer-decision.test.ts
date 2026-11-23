import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allowedDecisions,
  decisionStatusFor,
  validateDecisionInput,
  type CustomerDecision,
} from '../../lib/domain/customer-decision.ts';
import type { CustomerAssessment } from '../../lib/domain/customer-assessment.ts';

function assessment(id: string, outcome: CustomerAssessment['outcome']): CustomerAssessment {
  return { id, outcome } as unknown as CustomerAssessment;
}

function decision(assessmentId: string, level: CustomerDecision['level'], value: CustomerDecision['decision']): CustomerDecision {
  return {
    id: `${assessmentId}-${level}`,
    tenantId: 't',
    customerId: 'c',
    assessmentId,
    level,
    decision: value,
    rationale: 'A rationale long enough',
    correlationId: 'x',
    decidedBy: 'u',
    decidedAt: '2026-11-23T00:00:00Z',
  };
}

void test('only REVIEW_REQUIRED results need a human decision', () => {
  assert.equal(decisionStatusFor(null, []).state, 'not_required');
  assert.equal(decisionStatusFor(assessment('a', 'PROCEED'), []).state, 'not_required');
  assert.equal(decisionStatusFor(assessment('a', 'REJECT'), []).state, 'not_required');
});

void test('the chain goes MLRO first, board only after an escalation', () => {
  const a = assessment('a', 'REVIEW_REQUIRED');
  assert.deepEqual(
    [decisionStatusFor(a, []).state, decisionStatusFor(a, []).pendingLevel],
    ['awaiting_mlro', 'mlro'],
  );
  assert.equal(decisionStatusFor(a, [decision('a', 'mlro', 'approve')]).state, 'approved');
  assert.equal(decisionStatusFor(a, [decision('a', 'mlro', 'reject')]).state, 'rejected');
  const escalated = decisionStatusFor(a, [decision('a', 'mlro', 'escalate')]);
  assert.deepEqual([escalated.state, escalated.pendingLevel], ['awaiting_board', 'board']);
  assert.equal(
    decisionStatusFor(a, [decision('a', 'mlro', 'escalate'), decision('a', 'board', 'reject')]).state,
    'rejected',
  );
});

void test('decisions on an older assessment do not count for the latest one', () => {
  const latest = assessment('new', 'REVIEW_REQUIRED');
  assert.equal(decisionStatusFor(latest, [decision('old', 'mlro', 'approve')]).state, 'awaiting_mlro');
});

void test('the board cannot escalate again', () => {
  assert.deepEqual(allowedDecisions('mlro'), ['approve', 'reject', 'escalate']);
  assert.deepEqual(allowedDecisions('board'), ['approve', 'reject']);
  assert.deepEqual(allowedDecisions(null), []);
});

void test('input validation mirrors the database rules', () => {
  assert.deepEqual(validateDecisionInput({ decision: 'approve', rationale: '  Enough detail here  ' }), {
    decision: 'approve',
    rationale: 'Enough detail here',
  });
  assert.throws(() => validateDecisionInput({ decision: 'maybe', rationale: 'Enough detail here' }), /approve, reject or escalate/);
  assert.throws(() => validateDecisionInput({ decision: 'reject', rationale: 'short' }), /too short/);
  assert.throws(() => validateDecisionInput({ decision: 'reject', rationale: 'x'.repeat(1001) }), /too long/);
});
