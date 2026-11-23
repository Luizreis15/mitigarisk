import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkQueue, daysUntil, workStageFor } from '../../lib/domain/work-queue.ts';
import { personaFromCapabilities } from '../../lib/domain/workspace-persona.ts';
import type { Customer } from '../../lib/domain/customer.ts';
import type { CustomerAssessment } from '../../lib/domain/customer-assessment.ts';
import type { CraResult } from '../../lib/domain/cra-engine.ts';

const NOW = new Date('2026-11-23T15:00:00Z');

function customer(name: string): Customer {
  return {
    id: name as Customer['id'],
    tenantId: 't1' as Customer['tenantId'],
    externalReference: name.toUpperCase(),
    fullName: name,
    dateOfBirth: '1990-01-01',
    countryOfBirth: 'MT',
    nationality: 'MT',
    residenceCountry: 'MT',
    onboardingChannel: 'face_to_face',
    status: 'active',
    createdBy: 'u1' as Customer['createdBy'],
    updatedBy: 'u1' as Customer['updatedBy'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function assessment(
  outcome: CraResult['outcome'],
  nextReviewDue: string,
  requiredActions: string[] = [],
  assessedAt = '2026-11-01T00:00:00.000Z',
): CustomerAssessment {
  const band = outcome === 'PROCEED' ? 'LOW' : 'HIGH';
  const result: CraResult = {
    overall_score: 10,
    category_scores: {},
    band,
    dd_level: outcome === 'PROCEED' ? 'SDD' : 'EDD',
    outcome,
    overrides_hit: [],
    approvals_required: [],
    required_actions: requiredActions,
    review_months: 12,
    missing_factors: [],
    reason_codes: [],
  };
  return {
    id: 'a' as CustomerAssessment['id'],
    tenantId: 't1' as CustomerAssessment['tenantId'],
    customerId: 'c' as CustomerAssessment['customerId'],
    policyVersionId: 'p' as CustomerAssessment['policyVersionId'],
    facts: {},
    result,
    overallScore: 10,
    band,
    ddLevel: result.dd_level,
    outcome,
    nextReviewDue,
    correlationId: 'x' as CustomerAssessment['correlationId'],
    inputHash: 'h',
    assessedBy: 'u1' as CustomerAssessment['assessedBy'],
    assessedAt,
    createdAt: assessedAt,
  };
}

void test('daysUntil counts whole UTC days and handles overdue dates', () => {
  assert.equal(daysUntil('2026-11-23', NOW), 0);
  assert.equal(daysUntil('2026-11-24', NOW), 1);
  assert.equal(daysUntil('2026-11-20', NOW), -3);
  assert.equal(daysUntil('not a date', NOW), null);
});

void test('each outcome lands in the stage that names the next step', () => {
  assert.equal(workStageFor(null, NOW), 'needs_assessment');
  assert.equal(workStageFor(assessment('REJECT', '2027-11-23'), NOW), 'do_not_onboard');
  assert.equal(workStageFor(assessment('REVIEW_REQUIRED', '2027-11-23'), NOW), 'awaiting_compliance');
  assert.equal(workStageFor(assessment('PROCEED', '2029-11-23'), NOW), 'cleared');
});

void test('a periodic review opens 90 days before it is due, and stays open when overdue', () => {
  assert.equal(workStageFor(assessment('PROCEED', '2027-02-21'), NOW), 'review_due'); // 90 days
  assert.equal(workStageFor(assessment('PROCEED', '2027-02-22'), NOW), 'cleared'); // 91 days
  assert.equal(workStageFor(assessment('PROCEED', '2026-10-01'), NOW), 'review_due'); // overdue
});

void test('a reject or compliance hold wins over an upcoming review date', () => {
  assert.equal(workStageFor(assessment('REJECT', '2026-12-01'), NOW), 'do_not_onboard');
  assert.equal(workStageFor(assessment('REVIEW_REQUIRED', '2026-12-01'), NOW), 'awaiting_compliance');
});

void test('the queue is ordered by urgency and counts every stage', () => {
  const queue = buildWorkQueue(
    [
      { customer: customer('cleared'), latest: assessment('PROCEED', '2029-11-23') },
      { customer: customer('hold'), latest: assessment('REVIEW_REQUIRED', '2027-11-23', ['OBTAIN_SOW_SOF_DOCUMENTS']) },
      { customer: customer('new'), latest: null },
      { customer: customer('due-late'), latest: assessment('PROCEED', '2027-01-30') },
      { customer: customer('due-soon'), latest: assessment('PROCEED', '2026-12-01') },
      { customer: customer('reject'), latest: assessment('REJECT', '2027-11-23', ['REPORT_TO_MLRO']) },
    ],
    NOW,
  );
  assert.deepEqual(
    queue.items.map((i) => i.customer.fullName),
    ['reject', 'new', 'due-soon', 'due-late', 'hold', 'cleared'],
  );
  assert.deepEqual(queue.counts, {
    do_not_onboard: 1,
    needs_assessment: 1,
    review_due: 2,
    awaiting_compliance: 1,
    cleared: 1,
  });
  assert.equal(queue.openCount, 5);
  assert.deepEqual(queue.items[0]?.requiredActions, ['REPORT_TO_MLRO']);
  assert.deepEqual(queue.items[1]?.requiredActions, []);
});

void test('the queue never mutates the stored required actions', () => {
  const latest = assessment('REVIEW_REQUIRED', '2027-11-23', ['VERIFY_ID']);
  const queue = buildWorkQueue([{ customer: customer('a'), latest }], NOW);
  queue.items[0]?.requiredActions.push('X');
  assert.deepEqual(latest.result.required_actions, ['VERIFY_ID']);
});

void test('persona follows the capability matrix of each role', () => {
  // tenant_admin: case.decide + audit.view + customer.manage
  assert.equal(personaFromCapabilities({ caseDecide: true, auditView: true, customerManage: true }), 'mlro');
  // risk_analyst: audit.view + customer.manage
  assert.equal(personaFromCapabilities({ caseDecide: false, auditView: true, customerManage: true }), 'analyst');
  // operator: customer.manage only
  assert.equal(personaFromCapabilities({ caseDecide: false, auditView: false, customerManage: true }), 'operator');
  // auditor: audit.view only
  assert.equal(personaFromCapabilities({ caseDecide: false, auditView: true, customerManage: false }), 'auditor');
  assert.equal(personaFromCapabilities({ caseDecide: false, auditView: false, customerManage: false }), 'member');
});

void test('required actions are shown most decisive first, keeping stored order otherwise', async () => {
  const { prioritizeRequiredActions } = await import('../../lib/domain/work-queue.ts');
  assert.deepEqual(
    prioritizeRequiredActions(['IDENTIFY_CUSTOMER', 'VERIFY_ID', 'REPORT_TO_MLRO', 'FREEZE_FUNDS_AND_BLOCK_IF_EXISTING']),
    ['FREEZE_FUNDS_AND_BLOCK_IF_EXISTING', 'REPORT_TO_MLRO', 'VERIFY_ID', 'IDENTIFY_CUSTOMER'],
  );
  assert.deepEqual(prioritizeRequiredActions(['CUSTOM_B', 'CUSTOM_A', 'VERIFY_ID']), ['VERIFY_ID', 'CUSTOM_B', 'CUSTOM_A']);
});

void test('the MLRO or board decision moves a REVIEW_REQUIRED case out of the compliance stage', () => {
  const held = assessment('REVIEW_REQUIRED', '2027-11-23');
  assert.equal(workStageFor(held, NOW, 90, 'awaiting_mlro'), 'awaiting_compliance');
  assert.equal(workStageFor(held, NOW, 90, 'awaiting_board'), 'awaiting_compliance');
  assert.equal(workStageFor(held, NOW, 90, 'approved'), 'cleared');
  assert.equal(workStageFor(held, NOW, 90, 'rejected'), 'do_not_onboard');
  assert.equal(workStageFor(assessment('REVIEW_REQUIRED', '2026-12-01'), NOW, 90, 'approved'), 'review_due');
  // A policy reject cannot be overturned by a decision.
  assert.equal(workStageFor(assessment('REJECT', '2027-11-23'), NOW, 90, 'approved'), 'do_not_onboard');
});
