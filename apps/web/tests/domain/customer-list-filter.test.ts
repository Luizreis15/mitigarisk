import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterCustomerListRows,
  summarizeCustomerListRows,
} from '../../lib/domain/customer-list-filter.ts';
import type { Customer } from '../../lib/domain/customer.ts';
import type { CustomerAssessment } from '../../lib/domain/customer-assessment.ts';
import type { CraResult } from '../../lib/domain/cra-engine.ts';

function customer(id: string, name: string, ref: string): Customer {
  return {
    id: id as Customer['id'],
    tenantId: 't1' as Customer['tenantId'],
    externalReference: ref,
    fullName: name,
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

function assessment(band: CustomerAssessment['band']): CustomerAssessment {
  const result: CraResult = {
    overall_score: 0,
    band,
    dd_level: 'SDD',
    outcome: 'PROCEED',
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
    band,
    ddLevel: 'SDD',
    outcome: 'PROCEED',
    nextReviewDue: '2029-10-06',
    correlationId: 'corr' as CustomerAssessment['correlationId'],
    inputHash: 'h',
    assessedBy: 'u1' as CustomerAssessment['assessedBy'],
    assessedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

const portfolio = [
  { customer: customer('1', 'Alex Rivera', 'CUST-001'), latest: assessment('LOW') },
  { customer: customer('2', 'Blake Chen', 'CUST-002'), latest: assessment('HIGH') },
  { customer: customer('3', 'Casey Brooks', 'CUST-003'), latest: null },
];

void test('filterCustomerListRows matches name or external reference', () => {
  const byName = filterCustomerListRows(portfolio, { query: 'blake', band: 'ALL' });
  assert.equal(byName.length, 1);
  assert.equal(byName[0]?.customer.fullName, 'Blake Chen');

  const byRef = filterCustomerListRows(portfolio, { query: 'cust-003', band: 'ALL' });
  assert.equal(byRef.length, 1);
  assert.equal(byRef[0]?.customer.externalReference, 'CUST-003');
});

void test('filterCustomerListRows filters by band without inventing assessments', () => {
  const high = filterCustomerListRows(portfolio, { query: '', band: 'HIGH' });
  assert.equal(high.length, 1);
  assert.equal(high[0]?.latest?.band, 'HIGH');

  const none = filterCustomerListRows(portfolio, { query: '', band: 'UNASSESSED' });
  assert.equal(none.length, 1);
  assert.equal(none[0]?.latest, null);
});

void test('summarizeCustomerListRows counts bands from persisted latest only', () => {
  const summary = summarizeCustomerListRows(portfolio);
  assert.deepEqual(summary, { total: 3, low: 1, medium: 0, high: 1, unassessed: 1 });
});
