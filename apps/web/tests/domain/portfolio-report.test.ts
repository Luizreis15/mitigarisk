import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  PORTFOLIO_CSV_COLUMNS,
  PORTFOLIO_REPORT_FORMAT,
  buildPortfolioReport,
  portfolioReportCsv,
} from '../../lib/domain/portfolio-report.ts';
import { canonicalJson } from '../../lib/domain/audit-pack.ts';
import type { Customer } from '../../lib/domain/customer.ts';
import type { CustomerAssessment } from '../../lib/domain/customer-assessment.ts';
import type { CustomerDecision } from '../../lib/domain/customer-decision.ts';
import { messages } from '../../lib/i18n/messages.ts';

const NOW = '2026-11-24T12:00:00.000Z';

function customer(n: number, name = `Customer ${n}`): Customer {
  return {
    id: `c${n}`,
    tenantId: 't1',
    externalReference: `REF-${n}`,
    fullName: name,
    dateOfBirth: '1990-01-01',
    countryOfBirth: 'PT',
    nationality: 'PT',
    residenceCountry: 'MT',
    onboardingChannel: 'face_to_face',
    status: 'active',
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  } as unknown as Customer;
}

function assessment(
  n: number,
  fields: { score: number; band: 'LOW' | 'MEDIUM' | 'HIGH'; dd: 'SDD' | 'CDD' | 'EDD'; outcome: 'PROCEED' | 'REVIEW_REQUIRED' | 'REJECT'; due: string; overrides?: string[] },
): CustomerAssessment {
  return {
    id: `a${n}`,
    customerId: `c${n}`,
    overallScore: fields.score,
    band: fields.band,
    ddLevel: fields.dd,
    outcome: fields.outcome,
    nextReviewDue: fields.due,
    assessedAt: '2026-11-10T09:00:00.000Z',
    result: { overrides_hit: fields.overrides ?? [], required_actions: [] },
  } as unknown as CustomerAssessment;
}

const decision = (n: number, level: 'mlro' | 'board', value: 'approve' | 'reject' | 'escalate'): CustomerDecision =>
  ({ id: `d${n}${level}`, assessmentId: `a${n}`, level, decision: value }) as unknown as CustomerDecision;

function sample() {
  const customers = [1, 2, 3, 4, 5, 6, 7].map((n) => customer(n));
  const latestByCustomer = new Map<string, CustomerAssessment>([
    ['c1', assessment(1, { score: 10, band: 'LOW', dd: 'SDD', outcome: 'PROCEED', due: '2029-11-10' })],
    ['c2', assessment(2, { score: 50, band: 'MEDIUM', dd: 'CDD', outcome: 'PROCEED', due: '2027-01-15' })],
    ['c3', assessment(3, { score: 0, band: 'HIGH', dd: 'EDD', outcome: 'REVIEW_REQUIRED', due: '2027-11-10', overrides: ['pep'] })],
    ['c4', assessment(4, { score: 80, band: 'HIGH', dd: 'EDD', outcome: 'REVIEW_REQUIRED', due: '2027-11-10' })],
    ['c5', assessment(5, { score: 90, band: 'HIGH', dd: 'EDD', outcome: 'REJECT', due: '2027-11-10', overrides: ['sanctions_confirmed'] })],
    ['c6', assessment(6, { score: 20, band: 'LOW', dd: 'SDD', outcome: 'PROCEED', due: '2026-11-01' })],
  ]);
  return buildPortfolioReport({
    generatedAt: NOW,
    generatedBy: 'u9',
    tenant: { id: 't1', name: 'Demo Ltd.' },
    customers,
    latestByCustomer,
    decisions: [decision(4, 'mlro', 'approve'), decision(99, 'mlro', 'reject')],
    triggerHitsByCustomer: new Map([['c1', 0], ['c2', 2]]),
  });
}

void test('rows are ordered by risk, then score, with customers not assessed last', () => {
  const report = sample();
  assert.equal(report.format, PORTFOLIO_REPORT_FORMAT);
  assert.deepEqual(report.customers.map((row) => row.external_reference), ['REF-5', 'REF-4', 'REF-3', 'REF-2', 'REF-6', 'REF-1', 'REF-7']);
});

void test('each row reads the stored result and derives only status and review distance', () => {
  const byRef = new Map(sample().customers.map((row) => [row.external_reference, row]));
  assert.deepEqual(byRef.get('REF-3'), {
    external_reference: 'REF-3',
    full_name: 'Customer 3',
    nationality: 'PT',
    residence_country: 'MT',
    onboarding_channel: 'face_to_face',
    registered_at: '2026-11-01T10:00:00.000Z',
    assessed_at: '2026-11-10T09:00:00.000Z',
    overall_score: 0,
    band: 'HIGH',
    band_set_by_rule: true,
    dd_level: 'EDD',
    outcome: 'REVIEW_REQUIRED',
    decision: 'awaiting_mlro',
    stage: 'awaiting_compliance',
    next_review_due: '2027-11-10',
    review_due_in_days: 351,
    transaction_triggers_hit: null,
  });
  assert.equal(byRef.get('REF-4')?.decision, 'approved');
  assert.equal(byRef.get('REF-4')?.stage, 'cleared');
  assert.equal(byRef.get('REF-5')?.stage, 'do_not_onboard');
  assert.equal(byRef.get('REF-5')?.decision, 'not_required');
  assert.equal(byRef.get('REF-6')?.review_due_in_days, -23);
  assert.equal(byRef.get('REF-6')?.stage, 'review_due');
  assert.equal(byRef.get('REF-2')?.stage, 'review_due');
  assert.equal(byRef.get('REF-2')?.transaction_triggers_hit, 2);
  const unassessed = byRef.get('REF-7');
  assert.equal(unassessed?.band, null);
  assert.equal(unassessed?.decision, null);
  assert.equal(unassessed?.stage, 'needs_assessment');
  assert.equal(unassessed?.review_due_in_days, null);
});

void test('the summary counts match the rows', () => {
  assert.deepEqual(sample().summary, {
    customers: 7,
    not_assessed: 1,
    band_low: 2,
    band_medium: 1,
    band_high: 3,
    high_by_rule: 2,
    dd_simplified: 2,
    dd_standard: 1,
    dd_enhanced: 3,
    awaiting_decision: 1,
    approved: 1,
    do_not_onboard: 1,
    reviews_overdue: 1,
    reviews_due_soon: 1,
    review_lead_days: 90,
    with_transaction_triggers: 1,
  });
});

void test('an empty portfolio is a valid report', () => {
  const report = buildPortfolioReport({
    generatedAt: NOW,
    generatedBy: 'u9',
    tenant: { id: 't1', name: null },
    customers: [],
    latestByCustomer: new Map(),
    decisions: [],
    triggerHitsByCustomer: new Map(),
  });
  assert.equal(report.summary.customers, 0);
  assert.equal(portfolioReportCsv(report), `${PORTFOLIO_CSV_COLUMNS.join(',')}\r\n`);
});

void test('the same input gives the same digest', () => {
  const digest = () => createHash('sha256').update(canonicalJson(sample())).digest('hex');
  assert.equal(digest(), digest());
  assert.match(digest(), /^[0-9a-f]{64}$/);
});

void test('the CSV has one line per customer, quotes what needs quoting and defuses formulas', () => {
  const report = buildPortfolioReport({
    generatedAt: NOW,
    generatedBy: 'u9',
    tenant: { id: 't1', name: null },
    customers: [customer(1, 'Silva, "Ana"'), customer(2, '=HYPERLINK("http://x")'), customer(3, '-Dash'), customer(4, 'Multi\nLine')],
    latestByCustomer: new Map(),
    decisions: [],
    triggerHitsByCustomer: new Map(),
  });
  const csv = portfolioReportCsv(report);
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(csv.startsWith('external_reference,full_name,'));
  assert.ok(csv.includes('REF-1,"Silva, ""Ana""",PT,MT,'));
  assert.ok(csv.includes(`REF-2,"'=HYPERLINK(""http://x"")",`));
  assert.ok(csv.includes("REF-3,'-Dash,"));
  assert.ok(csv.includes('REF-4,"Multi\nLine",'));
  const first = csv.split('\r\n')[1].split(',');
  assert.equal(first.length, PORTFOLIO_CSV_COLUMNS.length + 1, 'only the quoted name adds a comma');
});

void test('every summary line and decision state has catalog copy', () => {
  const copy = messages.portfolioReport;
  const summaryKeys = Object.keys(sample().summary).filter((key) => key !== 'review_lead_days');
  assert.deepEqual(Object.keys(copy.summary).sort(), summaryKeys.sort());
  assert.deepEqual(Object.keys(copy.decisionStates).sort(), ['approved', 'awaiting_board', 'awaiting_mlro', 'not_required', 'rejected']);
  assert.ok(JSON.stringify(messages).includes('"portfolio.report_generated":'), 'the audit trail names the event');
});
