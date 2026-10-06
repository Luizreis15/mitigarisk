import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOT_KNOWN_FACTOR_VALUE,
  buildAssessmentFacts,
  decodeOverrideValue,
  encodeOverrideValue,
  factorFieldName,
  overrideFieldName,
  InvalidFactorAnswerError,
  InvalidOverrideAnswerError,
  MissingOverrideAnswerError,
} from '../../lib/domain/customer-assessment-facts.ts';
import { CRA_FACTOR_VALUE_MAX_LENGTH, type CustomerAssessmentForm } from '../../lib/domain/customer-assessment.ts';
import type { PolicyVersionId } from '../../lib/domain/ids.ts';

const longValue = 'x'.repeat(CRA_FACTOR_VALUE_MAX_LENGTH + 1);

const FORM: CustomerAssessmentForm = {
  policyVersionId: '20000000-0000-0000-0000-000000000020' as PolicyVersionId,
  policyLabel: 'MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)',
  categories: [
    {
      key: 'customer',
      label: 'Customer',
      position: 1,
      factors: [
        { key: 'purpose', position: 1, values: ['ecommerce', 'gambling', 'multipurpose'] },
        { key: 'prior_str', position: 2, values: ['none', 'one_or_more', longValue] },
      ],
    },
    {
      key: 'channel',
      label: 'Delivery channel',
      position: 2,
      factors: [{ key: 'channel', position: 1, values: ['face_to_face', 'non_face_to_face'] }],
    },
  ],
  overrides: [
    { factKey: 'sanctions_match', values: ['confirmed', 'inconclusive', 'none'], negativeValue: 'none', provisional: false },
    { factKey: 'hnwi', values: [true, false], negativeValue: false, provisional: true },
  ],
};

function reader(fields: Record<string, string>) {
  return (name: string) => (Object.prototype.hasOwnProperty.call(fields, name) ? fields[name] : null);
}

const NEGATIVE_OVERRIDES = {
  [overrideFieldName('sanctions_match')]: encodeOverrideValue('none'),
  [overrideFieldName('hnwi')]: encodeOverrideValue(false),
};

void test('allowed factor and override values are kept with their exact JSON types', () => {
  const facts = buildAssessmentFacts(
    FORM,
    reader({
      [factorFieldName('purpose')]: 'gambling',
      [factorFieldName('prior_str')]: 'none',
      [factorFieldName('channel')]: 'non_face_to_face',
      [overrideFieldName('sanctions_match')]: encodeOverrideValue('confirmed'),
      [overrideFieldName('hnwi')]: encodeOverrideValue(true),
    }),
  );
  assert.deepEqual(facts, {
    purpose: 'gambling',
    prior_str: 'none',
    channel: 'non_face_to_face',
    sanctions_match: 'confirmed',
    hnwi: true,
  });
});

void test('"Not known" and unanswered factors are omitted so the database applies missing-data semantics', () => {
  const facts = buildAssessmentFacts(
    FORM,
    reader({
      [factorFieldName('purpose')]: NOT_KNOWN_FACTOR_VALUE,
      [factorFieldName('prior_str')]: '',
      ...NEGATIVE_OVERRIDES,
    }),
  );
  assert.deepEqual(facts, { sanctions_match: 'none', hnwi: false });
  assert.ok(!('purpose' in facts) && !('prior_str' in facts) && !('channel' in facts));
});

void test('submitted keys the form does not list are dropped', () => {
  const facts = buildAssessmentFacts(
    FORM,
    reader({
      ...NEGATIVE_OVERRIDES,
      [factorFieldName('overall_score')]: '0',
      [factorFieldName('band')]: 'LOW',
      overall_score: '0',
      band: 'LOW',
      outcome: 'PROCEED',
      [overrideFieldName('injected_fact')]: encodeOverrideValue('none'),
    }),
  );
  assert.deepEqual(Object.keys(facts).sort(), ['hnwi', 'sanctions_match']);
});

void test('a factor value outside the allowed list is rejected, not silently treated as missing', () => {
  assert.throws(
    () => buildAssessmentFacts(FORM, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('purpose')]: 'casino' })),
    InvalidFactorAnswerError,
  );
});

void test('every override is required', () => {
  assert.throws(
    () => buildAssessmentFacts(FORM, reader({ [overrideFieldName('hnwi')]: encodeOverrideValue(false) })),
    (error: unknown) => error instanceof MissingOverrideAnswerError && error.factKey === 'sanctions_match',
  );
  assert.throws(
    () => buildAssessmentFacts(FORM, reader({ ...NEGATIVE_OVERRIDES, [overrideFieldName('hnwi')]: '' })),
    MissingOverrideAnswerError,
  );
});

void test('override values are type- and case-strict', () => {
  for (const bad of ['string:true', 'string:Confirmed', 'boolean:yes', 'none', 'true', 'number:1']) {
    const fields = { ...NEGATIVE_OVERRIDES };
    fields[overrideFieldName(bad.includes('true') || bad.includes('yes') || bad.includes('1') ? 'hnwi' : 'sanctions_match')] = bad;
    assert.throws(() => buildAssessmentFacts(FORM, reader(fields)), InvalidOverrideAnswerError, bad);
  }
});

void test('a factor value longer than CRA_FACTOR_VALUE_MAX_LENGTH is rejected even if listed', () => {
  assert.throws(
    () => buildAssessmentFacts(FORM, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('prior_str')]: longValue })),
    InvalidFactorAnswerError,
  );
  const atLimit = 'y'.repeat(CRA_FACTOR_VALUE_MAX_LENGTH);
  const form: CustomerAssessmentForm = {
    ...FORM,
    categories: [{ key: 'c', label: 'C', position: 1, factors: [{ key: 'f', position: 1, values: [atLimit] }] }],
  };
  assert.deepEqual(
    buildAssessmentFacts(form, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('f')]: atLimit })),
    { f: atLimit, sanctions_match: 'none', hnwi: false },
  );
});

void test('override value encoding round-trips without string/boolean collisions', () => {
  for (const value of ['none', 'true', 'false', 'string:x', true, false] as const) {
    assert.equal(decodeOverrideValue(encodeOverrideValue(value)), value);
  }
  assert.notEqual(encodeOverrideValue('true'), encodeOverrideValue(true));
  assert.equal(decodeOverrideValue('garbage'), null);
});
