import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CUSTOMER_FORM_FIELDS,
  customerErrorField,
  pickSubmittedCustomerValues,
} from '../../lib/domain/customer-form-state.ts';
import { InvalidCustomerCountryCodeError, InvalidFullNameError } from '../../lib/domain/customer.ts';
import { DuplicateCustomerReferenceError } from '../../lib/supabase/customers-repository.ts';
import { customerErrorMessage } from '../../lib/i18n/customer-errors.ts';
import { customerStatusLabel, onboardingChannelLabel } from '../../lib/i18n/customer.ts';
import { messages } from '../../lib/i18n/messages.ts';

const errors = messages.customerWorkspace.errors;

void test('the create form echoes back exactly its seven fields, bounded in length', () => {
  const submitted: Record<string, string> = {
    externalReference: 'CUST-1',
    fullName: 'Ana 🙂 Souza',
    dateOfBirth: '1990-01-01',
    countryOfBirth: 'PT',
    nationality: 'BR',
    residenceCountry: 'x'.repeat(5000),
    onboardingChannel: 'face_to_face',
    tenantId: 'other-tenant',
    overall_score: '0',
  };
  const values = pickSubmittedCustomerValues((name) => (Object.hasOwn(submitted, name) ? submitted[name] : ''));
  assert.deepEqual(Object.keys(values), [...CUSTOMER_FORM_FIELDS]);
  assert.equal(values.fullName, 'Ana 🙂 Souza');
  assert.equal(values.residenceCountry.length, 300);
  assert.ok(!('tenantId' in values) && !('overall_score' in values));
});

void test('create errors point at the offending field', () => {
  assert.equal(customerErrorField(new DuplicateCustomerReferenceError('CUST-1')), 'externalReference');
  assert.equal(customerErrorField(new InvalidFullNameError()), 'fullName');
  assert.equal(customerErrorField(new InvalidCustomerCountryCodeError('nationality')), 'nationality');
  assert.equal(customerErrorField(new Error('other')), null);
  const inherited = new Error('x');
  inherited.name = 'toString';
  assert.equal(customerErrorField(inherited), null);
});

void test('error copy is looked up by own property only, with a safe fallback', () => {
  assert.equal(customerErrorMessage('InvalidFullNameError'), errors.InvalidFullNameError);
  for (const code of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'NotARealError', '']) {
    assert.equal(customerErrorMessage(code), errors.UnknownError, code);
  }
});

void test('every error the customer actions can return has catalog copy', () => {
  const actions = readFileSync(fileURLToPath(new URL('../../app/workspace/customers/actions.ts', import.meta.url)), 'utf8');
  const codes = new Set([...actions.matchAll(/code: '(\w+)'/g)].map((match) => match[1]));
  for (const name of [
    'DuplicateAssessmentFieldError',
    'ReservedFactKeyError',
    'InvalidFactorAnswerError',
    'MissingOverrideAnswerError',
    'InvalidOverrideAnswerError',
    ...codes,
  ]) {
    assert.ok(Object.hasOwn(errors, name), `missing catalog copy for ${name}`);
  }
});

void test('unknown customer statuses and channels still render a readable label', () => {
  assert.equal(customerStatusLabel('active'), messages.customerWorkspace.statusValues.active);
  assert.equal(customerStatusLabel('under_investigation'), 'Under investigation');
  assert.equal(customerStatusLabel('constructor'), 'Constructor');
  assert.equal(onboardingChannelLabel('face_to_face'), messages.customerWorkspace.onboardingChannels.face_to_face);
  assert.equal(onboardingChannelLabel('video_call'), 'Video call');
});
