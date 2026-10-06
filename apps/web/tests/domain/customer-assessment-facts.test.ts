import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOT_KNOWN_FACTOR_VALUE,
  RESERVED_FACT_KEYS,
  assessmentErrorField,
  buildAssessmentFacts,
  codePointLength,
  decodeOverrideValue,
  encodeFactorValue,
  encodeOverrideValue,
  factorFieldName,
  overrideFieldName,
  pickSubmittedAssessmentValues,
  DuplicateAssessmentFieldError,
  InvalidFactorAnswerError,
  InvalidOverrideAnswerError,
  MissingOverrideAnswerError,
  ReservedFactKeyError,
  type FieldReader,
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

/** Mirrors FormData.getAll: every value for a name, in order. */
function reader(fields: Record<string, string | string[]>): FieldReader {
  return (name) => {
    if (!Object.hasOwn(fields, name)) return [];
    const value = fields[name];
    return Array.isArray(value) ? value : [value];
  };
}

const plain = (facts: object) => ({ ...facts });

const NEGATIVE_OVERRIDES = {
  [overrideFieldName('sanctions_match')]: encodeOverrideValue('none'),
  [overrideFieldName('hnwi')]: encodeOverrideValue(false),
};

void test('allowed factor and override values are kept with their exact JSON types', () => {
  const facts = buildAssessmentFacts(
    FORM,
    reader({
      [factorFieldName('purpose')]: encodeFactorValue('gambling'),
      [factorFieldName('prior_str')]: encodeFactorValue('none'),
      [factorFieldName('channel')]: encodeFactorValue('non_face_to_face'),
      [overrideFieldName('sanctions_match')]: encodeOverrideValue('confirmed'),
      [overrideFieldName('hnwi')]: encodeOverrideValue(true),
    }),
  );
  assert.deepEqual(plain(facts), {
    purpose: 'gambling',
    prior_str: 'none',
    channel: 'non_face_to_face',
    sanctions_match: 'confirmed',
    hnwi: true,
  });
});

void test('facts are a null-prototype object', () => {
  const facts = buildAssessmentFacts(FORM, reader(NEGATIVE_OVERRIDES));
  assert.equal(Object.getPrototypeOf(facts), null);
  assert.equal(JSON.stringify(facts), '{"sanctions_match":"none","hnwi":false}');
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
  assert.deepEqual(plain(facts), { sanctions_match: 'none', hnwi: false });
});

void test('the "Not known" sentinel can never collide with a policy value', () => {
  const form: CustomerAssessmentForm = {
    ...FORM,
    categories: [{ key: 'c', label: 'C', position: 1, factors: [{ key: 'f', position: 1, values: ['not_known'] }] }],
  };
  assert.notEqual(encodeFactorValue('not_known'), NOT_KNOWN_FACTOR_VALUE);
  assert.deepEqual(
    plain(buildAssessmentFacts(form, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('f')]: encodeFactorValue('not_known') }))),
    { f: 'not_known', sanctions_match: 'none', hnwi: false },
  );
  assert.deepEqual(
    plain(buildAssessmentFacts(form, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('f')]: NOT_KNOWN_FACTOR_VALUE }))),
    { sanctions_match: 'none', hnwi: false },
  );
});

void test('submitted keys the form does not list are dropped', () => {
  const facts = buildAssessmentFacts(
    FORM,
    reader({
      ...NEGATIVE_OVERRIDES,
      [factorFieldName('overall_score')]: encodeFactorValue('0'),
      [factorFieldName('__proto__')]: encodeFactorValue('x'),
      overall_score: '0',
      band: 'LOW',
      outcome: 'PROCEED',
      [overrideFieldName('injected_fact')]: encodeOverrideValue('none'),
    }),
  );
  assert.deepEqual(Object.keys(facts).sort(), ['hnwi', 'sanctions_match']);
});

void test('a factor value outside the allowed list, unprefixed, or case-changed is rejected', () => {
  for (const bad of [encodeFactorValue('casino'), 'gambling', encodeFactorValue('Gambling')]) {
    assert.throws(
      () => buildAssessmentFacts(FORM, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('purpose')]: bad })),
      InvalidFactorAnswerError,
      bad,
    );
  }
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
  const cases: Array<[string, string]> = [
    ['hnwi', 'string:true'],
    ['sanctions_match', 'string:Confirmed'],
    ['hnwi', 'boolean:yes'],
    ['sanctions_match', 'none'],
    ['hnwi', 'true'],
    ['hnwi', 'number:1'],
  ];
  for (const [factKey, bad] of cases) {
    const fields = { ...NEGATIVE_OVERRIDES, [overrideFieldName(factKey)]: bad };
    assert.throws(() => buildAssessmentFacts(FORM, reader(fields)), InvalidOverrideAnswerError, bad);
  }
});

void test('a field submitted more than once is rejected, for factors and overrides', () => {
  assert.throws(
    () =>
      buildAssessmentFacts(
        FORM,
        reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('purpose')]: [encodeFactorValue('ecommerce'), encodeFactorValue('gambling')] }),
      ),
    (error: unknown) => error instanceof DuplicateAssessmentFieldError && error.fieldName === 'factor.purpose',
  );
  assert.throws(
    () =>
      buildAssessmentFacts(
        FORM,
        reader({ ...NEGATIVE_OVERRIDES, [overrideFieldName('hnwi')]: [encodeOverrideValue(false), encodeOverrideValue(false)] }),
      ),
    DuplicateAssessmentFieldError,
  );
});

void test('a policy listing a reserved object key is rejected deterministically', () => {
  for (const key of RESERVED_FACT_KEYS) {
    const asFactor: CustomerAssessmentForm = {
      ...FORM,
      categories: [{ key: 'c', label: 'C', position: 1, factors: [{ key, position: 1, values: ['a'] }] }],
    };
    assert.throws(
      () => buildAssessmentFacts(asFactor, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName(key)]: encodeFactorValue('a') })),
      (error: unknown) => error instanceof ReservedFactKeyError && error.factKey === key,
    );
    const asOverride: CustomerAssessmentForm = {
      ...FORM,
      overrides: [{ factKey: key, values: ['hit', 'none'], negativeValue: 'none', provisional: false }],
    };
    assert.throws(
      () => buildAssessmentFacts(asOverride, reader({ [overrideFieldName(key)]: encodeOverrideValue('none') })),
      ReservedFactKeyError,
    );
  }
});

void test('a factor value longer than CRA_FACTOR_VALUE_MAX_LENGTH is rejected even if listed', () => {
  assert.throws(
    () => buildAssessmentFacts(FORM, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('prior_str')]: encodeFactorValue(longValue) })),
    InvalidFactorAnswerError,
  );
});

void test('the length bound counts code points like PostgreSQL char_length, not UTF-16 units', () => {
  const emoji64 = '🙂'.repeat(CRA_FACTOR_VALUE_MAX_LENGTH);
  const emoji65 = '🙂'.repeat(CRA_FACTOR_VALUE_MAX_LENGTH + 1);
  assert.equal(emoji64.length, 128);
  assert.equal(codePointLength(emoji64), 64);
  const form: CustomerAssessmentForm = {
    ...FORM,
    categories: [{ key: 'c', label: 'C', position: 1, factors: [{ key: 'f', position: 1, values: [emoji64, emoji65] }] }],
  };
  assert.deepEqual(
    plain(buildAssessmentFacts(form, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('f')]: encodeFactorValue(emoji64) }))),
    { f: emoji64, sanctions_match: 'none', hnwi: false },
  );
  assert.throws(
    () => buildAssessmentFacts(form, reader({ ...NEGATIVE_OVERRIDES, [factorFieldName('f')]: encodeFactorValue(emoji65) })),
    InvalidFactorAnswerError,
  );
});

void test('override value encoding round-trips without string/boolean collisions', () => {
  for (const value of ['none', 'true', 'false', 'string:x', true, false] as const) {
    assert.equal(decodeOverrideValue(encodeOverrideValue(value)), value);
  }
  assert.notEqual(encodeOverrideValue('true'), encodeOverrideValue(true));
  assert.equal(decodeOverrideValue('garbage'), null);
});

void test('submitted values are echoed back only for fields the form lists', () => {
  const echoed = pickSubmittedAssessmentValues(
    FORM,
    reader({
      [factorFieldName('purpose')]: encodeFactorValue('gambling'),
      [overrideFieldName('hnwi')]: [encodeOverrideValue(true), encodeOverrideValue(false)],
      [factorFieldName('injected')]: 'x',
      tenantId: 'other',
    }),
  );
  assert.deepEqual(echoed, {
    'factor.purpose': 'value:gambling',
    'override.hnwi': 'boolean:true',
  });
});

void test('submission errors point at the offending field', () => {
  assert.equal(assessmentErrorField(new InvalidFactorAnswerError('purpose')), 'factor.purpose');
  assert.equal(assessmentErrorField(new MissingOverrideAnswerError('hnwi')), 'override.hnwi');
  assert.equal(assessmentErrorField(new InvalidOverrideAnswerError('pep_status')), 'override.pep_status');
  assert.equal(assessmentErrorField(new DuplicateAssessmentFieldError('factor.channel')), 'factor.channel');
  assert.equal(assessmentErrorField(new Error('other')), null);
});
