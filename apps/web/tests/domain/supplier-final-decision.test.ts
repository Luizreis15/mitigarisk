import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSupplierFinalDecision,
  validateSupplierDecisionRationale,
  InvalidSupplierFinalDecisionError,
  InvalidSupplierDecisionRationaleError,
} from '../../lib/domain/supplier-final-decision.ts';

void test('accepts only the three approved final decisions', () => {
  for (const value of ['approve', 'review', 'reject']) assert.equal(validateSupplierFinalDecision(value), value);
  for (const value of ['', 'approved', 'escalate', 'APPROVE']) {
    assert.throws(() => validateSupplierFinalDecision(value), InvalidSupplierFinalDecisionError);
  }
});

void test('trims optional rationale and enforces its bound', () => {
  assert.equal(validateSupplierDecisionRationale('  documented reason  '), 'documented reason');
  assert.equal(validateSupplierDecisionRationale('   '), null);
  assert.throws(() => validateSupplierDecisionRationale('x'.repeat(501)), InvalidSupplierDecisionRationaleError);
});
