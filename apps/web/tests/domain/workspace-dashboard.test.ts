import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCompanyDashboardSnapshot } from '../../lib/domain/workspace-dashboard.ts';
import type { Customer } from '../../lib/domain/customer.ts';
import type { CustomerAssessment } from '../../lib/domain/customer-assessment.ts';
import type { CraResult } from '../../lib/domain/cra-engine.ts';

function customer(id: string): Customer {
  return {
    id: id as Customer['id'],
    tenantId: 't1' as Customer['tenantId'],
    externalReference: id,
    fullName: id,
    dateOfBirth: '1990-01-01',
    countryOfBirth: 'MT',
    nationality: 'MT',
    residenceCountry: 'MT',
    onboardingChannel: 'face_to_face',
    status: 'active',
    createdBy: 'u1' as Customer['createdBy'],
    updatedBy: 'u1' as Customer['updatedBy'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function assessment(
  partial: Pick<CustomerAssessment, 'band' | 'outcome' | 'nextReviewDue'>,
): CustomerAssessment {
  const result: CraResult = {
    overall_score: 0,
    band: partial.band,
    dd_level: 'SDD',
    outcome: partial.outcome,
    category_scores: {},
    overrides_hit: [],
    required_actions: [],
    approvals_required: [],
    missing_factors: [],
    reason_codes: [],
    review_months: 12,
  };
  return {
    id: 'a1' as CustomerAssessment['id'],
    tenantId: 't1' as CustomerAssessment['tenantId'],
    customerId: 'c1' as CustomerAssessment['customerId'],
    policyVersionId: 'p1' as CustomerAssessment['policyVersionId'],
    facts: {},
    result,
    overallScore: 0,
    band: partial.band,
    ddLevel: 'SDD',
    outcome: partial.outcome,
    nextReviewDue: partial.nextReviewDue,
    correlationId: 'corr' as CustomerAssessment['correlationId'],
    inputHash: 'h',
    assessedBy: 'u1' as CustomerAssessment['assessedBy'],
    assessedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

void test('buildCompanyDashboardSnapshot matches demo-shaped portfolio counts', () => {
  const now = new Date('2026-10-19T00:00:00.000Z');
  const snap = buildCompanyDashboardSnapshot(
    [
      {
        customer: customer('alex'),
        latest: assessment({
          band: 'LOW',
          outcome: 'PROCEED',
          nextReviewDue: '2029-10-06',
        }),
      },
      {
        customer: customer('blake'),
        latest: assessment({
          band: 'HIGH',
          outcome: 'REVIEW_REQUIRED',
          nextReviewDue: '2027-10-06',
        }),
      },
      {
        customer: customer('casey'),
        latest: assessment({
          band: 'HIGH',
          outcome: 'REJECT',
          nextReviewDue: '2027-10-06',
        }),
      },
    ],
    now,
    90,
  );

  assert.equal(snap.customerTotal, 3);
  assert.equal(snap.bandLow, 1);
  assert.equal(snap.bandMedium, 0);
  assert.equal(snap.bandHigh, 2);
  assert.equal(snap.unassessed, 0);
  assert.equal(snap.rejectCount, 1);
  assert.equal(snap.reviewsDueCount, 0);
});

void test('buildCompanyDashboardSnapshot counts unassessed and reviews inside horizon', () => {
  const now = new Date('2026-10-19T00:00:00.000Z');
  const snap = buildCompanyDashboardSnapshot(
    [
      { customer: customer('new'), latest: null },
      {
        customer: customer('soon'),
        latest: assessment({
          band: 'MEDIUM',
          outcome: 'PROCEED',
          nextReviewDue: '2026-11-01',
        }),
      },
    ],
    now,
    90,
  );

  assert.equal(snap.unassessed, 1);
  assert.equal(snap.bandMedium, 1);
  assert.equal(snap.reviewsDueCount, 1);
});
