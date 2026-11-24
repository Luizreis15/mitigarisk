import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InvalidTransactionInputError,
  TRANSACTION_FORM_FIELDS,
  buildTransactionInputs,
} from '../../lib/domain/transaction-check.ts';

const base: Record<string, string> = {
  lifetime_deposits: '600',
  lifetime_withdrawals: '0',
  deposits_180d: '2,500.50',
  linked_deposits: '0',
  linked_withdrawals: '0',
  days_since_registration: '30',
};
const reader = (values: Record<string, string>) => (name: string) => values[name] ?? '';

void test('required amounts and days become numbers; optional blanks are omitted', () => {
  assert.deepEqual(buildTransactionInputs(reader(base)), {
    lifetime_deposits: 600,
    lifetime_withdrawals: 0,
    deposits_180d: 2500.5,
    linked_deposits: 0,
    linked_withdrawals: 0,
    days_since_registration: 30,
    prior_sow_documents: false,
  });
});

void test('prior SOW documents is true only for the checkbox value "true"', () => {
  assert.equal(buildTransactionInputs(reader({ ...base, prior_sow_documents: 'true' })).prior_sow_documents, true);
  assert.equal(buildTransactionInputs(reader({ ...base, prior_sow_documents: 'on' })).prior_sow_documents, false);
});

void test('invalid amounts and day counts name the offending field', () => {
  const cases: Array<[Record<string, string>, string]> = [
    [{ ...base, deposits_180d: '' }, 'deposits_180d'],
    [{ ...base, deposits_180d: '-5' }, 'deposits_180d'],
    [{ ...base, deposits_180d: '12.345' }, 'deposits_180d'],
    [{ ...base, deposits_180d: '1e9' }, 'deposits_180d'],
    [{ ...base, lifetime_deposits: '2000000000' }, 'lifetime_deposits'],
    [{ ...base, days_since_registration: '10.5' }, 'days_since_registration'],
    [{ ...base, days_since_registration: '' }, 'days_since_registration'],
  ];
  for (const [values, field] of cases) {
    assert.throws(
      () => buildTransactionInputs(reader(values)),
      (error: unknown) => error instanceof InvalidTransactionInputError && error.field === field,
      field,
    );
  }
});

void test('optional rules need both of their values', () => {
  assert.throws(() => buildTransactionInputs(reader({ ...base, affordability_limit: '3000' })), /Affordability needs both/);
  assert.throws(() => buildTransactionInputs(reader({ ...base, deposits_30d: '100' })), /30-day rule needs both/);
  const full = buildTransactionInputs(
    reader({ ...base, affordability_limit: '3000', sow_deposits: '4000', sow_withdrawals: '1000', deposits_30d: '100', declared_monthly_income: '2500' }),
  );
  assert.equal(full.affordability_limit, 3000);
  assert.equal(full.declared_monthly_income, 2500);
});

void test('the form never carries a result, status or threshold field', () => {
  for (const field of TRANSACTION_FORM_FIELDS) {
    assert.doesNotMatch(field, /hit|status|threshold|result|score|band|outcome|action/i, field);
  }
});
