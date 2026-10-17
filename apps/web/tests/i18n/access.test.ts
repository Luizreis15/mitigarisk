import assert from 'node:assert/strict';
import test from 'node:test';

import { auditActionLabel, membershipRoleLabel } from '../../lib/i18n/access.ts';

void test('auditActionLabel maps known customer and membership actions', () => {
  assert.equal(auditActionLabel('customer.assessed'), 'Customer risk assessment run');
  assert.equal(auditActionLabel('membership.activated'), 'Invitation accepted');
});

void test('auditActionLabel humanizes unknown actions without inventing meaning', () => {
  assert.equal(auditActionLabel('custom.thing'), 'custom thing');
});

void test('membershipRoleLabel uses company admin catalog copy', () => {
  assert.equal(membershipRoleLabel('tenant_admin'), 'Company admin');
  assert.equal(membershipRoleLabel('auditor'), 'Auditor');
});
