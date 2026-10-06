import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildAssessmentResultView,
  humanizeCode,
  type AssessmentResultSource,
} from '../../lib/i18n/customer-assessment.ts';
import { messages } from '../../lib/i18n/messages.ts';
import type { CraResult, CraTemplate } from '../../lib/domain/cra-engine.ts';

// Presentation tests for the reusable CRA result component's view model
// (docs/tasks/TASK-035-cursor-customer-assessment-experience.md, "Result
// presentation"), driven by the casebook's expected outputs, which are the
// exact results the database persists (TASK-033 replays all 24).

interface CasebookCase {
  id: string;
  expected: CraResult;
}

const casebook = JSON.parse(
  readFileSync(new URL('../fixtures/cra-casebook-v1.json', import.meta.url), 'utf8'),
) as CasebookCase[];
const template = JSON.parse(
  readFileSync(new URL('../fixtures/cra-template-v1-draft.json', import.meta.url), 'utf8'),
) as CraTemplate;

const t = messages.customerWorkspace;

function persisted(id: string): AssessmentResultSource {
  const found = casebook.find((entry) => entry.id === id);
  assert.ok(found, `casebook case ${id} must exist`);
  return {
    result: found.expected,
    nextReviewDue: '2029-10-06',
    policyVersionId: '00000000-0000-4000-8000-000000000001',
    assessedAt: '2026-10-06T12:00:00Z',
    correlationId: '00000000-0000-4000-8000-0000000000aa',
  };
}

void test('LOW / SDD clean profile (CB-01) renders as proceed with no approvals or overrides', () => {
  const view = buildAssessmentResultView(persisted('CB-01'));
  assert.equal(view.band, 'LOW');
  assert.equal(view.bandLabel, 'Low');
  assert.equal(view.ddLevel, 'SDD');
  assert.equal(view.ddLevelLabel, 'Simplified due diligence (SDD)');
  assert.equal(view.outcomeLabel, 'Proceed with onboarding');
  assert.equal(view.overallScoreText, '0');
  assert.equal(view.isReject, false);
  assert.equal(view.requiresMlroSignOff, false);
  assert.deepEqual(view.approvals, []);
  assert.deepEqual(view.overrides, []);
  assert.deepEqual(
    view.requiredActions.map((action) => action.label),
    ['Identify the customer', 'Verify the identity document', 'Keep the customer under ongoing screening'],
  );
  assert.equal(view.reviewMonths, 36);
  assert.equal(view.nextReviewDueText, 'Oct 6, 2029');
  assert.deepEqual(view.missingFactors, []);
});

void test('HIGH / EDD confirmed PEP (CB-11) shows MLRO sign-off as pending and not actionable', () => {
  const view = buildAssessmentResultView(persisted('CB-11'));
  assert.equal(view.band, 'HIGH');
  assert.equal(view.ddLevel, 'EDD');
  assert.equal(view.ddLevelLabel, 'Enhanced due diligence (EDD)');
  assert.equal(view.outcome, 'REVIEW_REQUIRED');
  assert.equal(view.outcomeLabel, 'Review required before onboarding');
  assert.equal(view.isReject, false);
  assert.equal(view.requiresMlroSignOff, true);
  const mlro = view.approvals.find((approval) => approval.code === 'MLRO');
  assert.ok(mlro);
  assert.equal(mlro.label, 'MLRO sign-off required');
  assert.equal(mlro.pending, true);
  assert.equal(mlro.actionable, false);
  assert.deepEqual(view.overrides, [{ code: 'OVR_PEP', label: t.overrides.OVR_PEP }]);
});

void test('REJECT confirmed sanctions match (CB-09) is presented as do-not-onboard with override reasons', () => {
  const view = buildAssessmentResultView(persisted('CB-09'));
  assert.equal(view.outcome, 'REJECT');
  assert.equal(view.isReject, true);
  assert.equal(view.outcomeLabel, 'Do not onboard — report to MLRO');
  assert.equal(t.result.rejectTitle, 'Do not onboard — report to MLRO');
  assert.deepEqual(view.overrides.map((override) => override.code), ['OVR_SANCTIONS_CONFIRMED']);
  assert.match(view.overrides[0].label, /sanctions/i);
  assert.ok(view.requiredActions.some((action) => action.label === 'Report to the MLRO'));
  assert.equal(view.requiresMlroSignOff, true);
});

void test('the view mirrors the persisted result verbatim and never re-derives a band, DD level, or outcome', () => {
  const source = persisted('CB-01');
  // Deliberately inconsistent input: if the view derived anything from the
  // score, this would not survive unchanged.
  const tampered: AssessmentResultSource = {
    ...source,
    result: { ...source.result, overall_score: 99.25, band: 'LOW', dd_level: 'SDD', outcome: 'PROCEED' },
  };
  const view = buildAssessmentResultView(tampered);
  assert.equal(view.overallScore, 99.25);
  assert.equal(view.overallScoreText, '99.25');
  assert.equal(view.band, 'LOW');
  assert.equal(view.ddLevel, 'SDD');
  assert.equal(view.outcome, 'PROCEED');
});

void test('every casebook result maps one-to-one onto the view', () => {
  for (const entry of casebook) {
    const view = buildAssessmentResultView({ ...persisted('CB-01'), result: entry.expected });
    assert.equal(view.overallScore, entry.expected.overall_score, entry.id);
    assert.equal(view.band, entry.expected.band, entry.id);
    assert.equal(view.ddLevel, entry.expected.dd_level, entry.id);
    assert.equal(view.outcome, entry.expected.outcome, entry.id);
    assert.equal(view.isReject, entry.expected.outcome === 'REJECT', entry.id);
    assert.equal(view.requiresMlroSignOff, entry.expected.approvals_required.includes('MLRO'), entry.id);
    assert.deepEqual(view.categoryScores.map((c) => [c.key, c.score]), Object.entries(entry.expected.category_scores), entry.id);
    assert.deepEqual(view.overrides.map((o) => o.code), entry.expected.overrides_hit, entry.id);
    assert.deepEqual(view.requiredActions.map((a) => a.code), entry.expected.required_actions, entry.id);
    assert.deepEqual(view.approvals.map((a) => a.code), entry.expected.approvals_required, entry.id);
    assert.deepEqual(view.missingFactors.map((f) => f.code), entry.expected.missing_factors, entry.id);
    assert.deepEqual(view.reasonCodes, entry.expected.reason_codes, entry.id);
    for (const category of view.categoryScores) {
      assert.ok(category.barPercent >= 0 && category.barPercent <= 100, entry.id);
    }
  }
});

void test('missing factors (CB-19) are listed with plain-English labels and raw codes', () => {
  const view = buildAssessmentResultView(persisted('CB-19'));
  assert.deepEqual(
    view.missingFactors,
    [
      { code: 'employment_status', label: 'Employment status' },
      { code: 'occupation_risk', label: 'Occupation risk' },
      { code: 'sow_country_risk', label: 'Source-of-wealth country risk' },
    ],
  );
});

void test('the catalog covers every category, factor, override, action, and approval in Template v1', () => {
  for (const category of template.categories) {
    assert.ok(category.key in t.categories, `category ${category.key}`);
    for (const factor of category.factors) {
      assert.ok(factor.key in t.factors, `factor ${factor.key}`);
    }
  }
  for (const override of template.overrides) {
    assert.ok(override.code in t.overrides, `override ${override.code}`);
    for (const action of override.actions ?? []) assert.ok(action in t.requiredActions, `action ${action}`);
    for (const approval of override.approvals ?? []) assert.ok(approval in t.approvals, `approval ${approval}`);
  }
  for (const band of template.bands) {
    assert.ok(band.band in t.bands);
    assert.ok(band.dd_level in t.ddLevels);
    for (const action of band.actions) assert.ok(action in t.requiredActions, `action ${action}`);
    for (const approval of band.approvals) assert.ok(approval in t.approvals, `approval ${approval}`);
  }
});

void test('unknown codes fall back to readable sentence case instead of breaking the screen', () => {
  assert.equal(humanizeCode('OVR_NEW_RULE'), 'Ovr new rule');
  assert.equal(humanizeCode('source_of_funds'), 'Source of funds');
  const source = persisted('CB-01');
  const view = buildAssessmentResultView({
    ...source,
    result: {
      ...source.result,
      category_scores: { ...source.result.category_scores, new_category: 12.5 },
      required_actions: [...source.result.required_actions, 'NEW_ACTION_CODE'],
      missing_factors: ['brand_new_factor'],
    },
  });
  assert.equal(view.categoryScores.at(-1)?.label, 'New category');
  assert.equal(view.requiredActions.at(-1)?.label, 'New action code');
  assert.equal(view.missingFactors[0].label, 'Brand new factor');
});
