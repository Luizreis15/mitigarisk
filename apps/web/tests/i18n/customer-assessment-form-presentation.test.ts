import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAssessmentFormView, factValueLabel } from '../../lib/i18n/customer-assessment-form.ts';
import {
  NOT_KNOWN_FACTOR_VALUE,
  decodeOverrideValue,
} from '../../lib/domain/customer-assessment-facts.ts';
import type { CustomerAssessmentForm } from '../../lib/domain/customer-assessment.ts';
import type { PolicyVersionId } from '../../lib/domain/ids.ts';

// The demo tenant's form as documented in the TASK-034 handoff (suite 110
// asserts this exact document), with categories and factors deliberately
// shuffled to prove the view orders by position.
const DEMO_FORM: CustomerAssessmentForm = {
  policyVersionId: '20000000-0000-0000-0000-000000000020' as PolicyVersionId,
  policyLabel: 'MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)',
  categories: [
    {
      key: 'geography', label: 'Geography', position: 2,
      factors: [
        { key: 'sow_country_risk', position: 3, values: ['high_risk_third_country', 'higher', 'standard'] },
        { key: 'residence_country_risk', position: 1, values: ['high_risk_third_country', 'higher', 'standard'] },
        { key: 'nationality_risk', position: 2, values: ['high_risk_third_country', 'higher', 'standard'] },
      ],
    },
    {
      key: 'customer', label: 'Customer', position: 1,
      factors: [
        { key: 'purpose', position: 1, values: ['ecommerce', 'gambling', 'multipurpose'] },
        { key: 'employment_status', position: 2, values: ['employed', 'retired', 'self_employed', 'student', 'unemployed'] },
      ],
    },
    {
      key: 'transactions', label: 'Transactions', position: 5,
      factors: [{ key: 'high_value_transactions', position: 3, values: ['no', 'not_observed', 'yes'] }],
    },
    {
      key: 'product_payment', label: 'Product / Service / Payment', position: 3,
      factors: [{ key: 'payment_method', position: 1, values: ['bank_transfer', 'card', 'cash'] }],
    },
  ],
  overrides: [
    { factKey: 'sanctions_match', values: ['confirmed', 'inconclusive', 'none'], negativeValue: 'none', provisional: false },
    { factKey: 'blacklisted_country_link', values: [true, false], negativeValue: false, provisional: false },
    { factKey: 'pep_status', values: ['confirmed', 'self_declared', 'none'], negativeValue: 'none', provisional: false },
    { factKey: 'adverse_media_material', values: ['material', 'potential', 'none'], negativeValue: 'none', provisional: false },
    { factKey: 'hnwi', values: [true, false], negativeValue: false, provisional: true },
  ],
};

void test('categories and factors are grouped and ordered by position', () => {
  const view = buildAssessmentFormView(DEMO_FORM);
  assert.deepEqual(view.categories.map((c) => c.key), ['customer', 'geography', 'product_payment', 'transactions']);
  assert.deepEqual(
    view.categories[1].factors.map((f) => f.key),
    ['residence_country_risk', 'nationality_risk', 'sow_country_risk'],
  );
  assert.equal(view.categories[2].label, 'Product, service and payment');
  assert.equal(view.policyLabel, DEMO_FORM.policyLabel);
  assert.equal(view.policyVersionId, DEMO_FORM.policyVersionId);
});

void test('every factor offers its policy values plus an explicit "Not known" option, selected by default', () => {
  const view = buildAssessmentFormView(DEMO_FORM);
  for (const category of view.categories) {
    for (const factor of category.factors) {
      const source = DEMO_FORM.categories.flatMap((c) => c.factors).find((f) => f.key === factor.key);
      assert.ok(source);
      assert.deepEqual(factor.options.slice(0, -1).map((o) => o.value), source.values);
      assert.deepEqual(factor.options.at(-1), { value: NOT_KNOWN_FACTOR_VALUE, label: 'Not known' });
      assert.equal(factor.defaultValue, NOT_KNOWN_FACTOR_VALUE);
      assert.equal(factor.name, `factor.${factor.key}`);
    }
  }
  const purpose = view.categories[0].factors[0];
  assert.equal(purpose.label, 'Purpose of the account');
  assert.deepEqual(purpose.options.map((o) => o.label), ['E-commerce', 'Gambling', 'Multipurpose', 'Not known']);
});

void test('every override is a required control whose negative answer is None or No', () => {
  const view = buildAssessmentFormView(DEMO_FORM);
  assert.deepEqual(view.overrides.map((o) => o.factKey), DEMO_FORM.overrides.map((o) => o.factKey));
  for (const override of view.overrides) {
    assert.equal(override.required, true);
    const negatives = override.options.filter((o) => o.negative);
    assert.equal(negatives.length, 1, override.factKey);
    assert.ok(['None', 'No'].includes(negatives[0].label), override.factKey);
    assert.ok(override.options.every((o) => !o.label.includes(NOT_KNOWN_FACTOR_VALUE)));
    assert.ok(!override.options.some((o) => o.label === 'Not known'), 'overrides have no "Not known" option');
  }
  const pep = view.overrides.find((o) => o.factKey === 'pep_status');
  assert.ok(pep);
  assert.equal(pep.label, 'Politically exposed person (PEP) status');
  assert.deepEqual(pep.options.map((o) => [decodeOverrideValue(o.value), o.label]), [
    ['confirmed', 'Confirmed'],
    ['self_declared', 'Self-declared'],
    ['none', 'None'],
  ]);
  const blacklist = view.overrides.find((o) => o.factKey === 'blacklisted_country_link');
  assert.deepEqual(blacklist?.options.map((o) => [decodeOverrideValue(o.value), o.label, o.negative]), [
    [true, 'Yes', false],
    [false, 'No', true],
  ]);
});

void test('only provisional overrides carry the provisional tag', () => {
  const view = buildAssessmentFormView(DEMO_FORM);
  assert.deepEqual(view.overrides.filter((o) => o.provisional).map((o) => o.factKey), ['hnwi']);
});

void test('labels fall back to readable sentence case for keys and values the catalog does not know', () => {
  const view = buildAssessmentFormView({
    ...DEMO_FORM,
    categories: [
      {
        key: 'source_of_funds', label: '', position: 1,
        factors: [{ key: 'crypto_exposure', position: 1, values: ['very_high', 'low'] }],
      },
      { key: 'other_category', label: 'Policy-defined label', position: 2, factors: [] },
    ],
    overrides: [{ factKey: 'new_watchlist_hit', values: ['probable', 'none'], negativeValue: 'none', provisional: false }],
  });
  assert.equal(view.categories[0].label, 'Source of funds');
  assert.equal(view.categories[1].label, 'Policy-defined label');
  assert.equal(view.categories[0].factors[0].label, 'Crypto exposure');
  assert.deepEqual(view.categories[0].factors[0].options.map((o) => o.label), ['Very high', 'Low', 'Not known']);
  assert.equal(view.overrides[0].label, 'New watchlist hit');
  assert.equal(factValueLabel('probable'), 'Probable');
});

void test('the form view exposes no weights, points, or scoring keys', () => {
  const serialized = JSON.stringify(buildAssessmentFormView(DEMO_FORM));
  assert.ok(!/weight|points|score|band/i.test(serialized));
});
