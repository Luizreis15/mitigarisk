import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

void test('final-decision action rejects platform admins and never trusts browser actor, role, recommendation, or policy', async () => {
  const source = await readFile(new URL('../../app/workspace/suppliers/actions.ts', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export async function recordSupplierFinalDecisionAction'));
  assert.match(body, /requireAuthenticatedIdentity/);
  assert.match(body, /if \(identity\.isPlatformAdmin\)/);
  assert.match(body, /resolveActiveTenantContext/);
  assert.match(body, /recordSupplierFinalDecision/);
  for (const forbidden of ["readFormValue(formData, 'actor", "readFormValue(formData, 'role", "readFormValue(formData, 'recommendation", "readFormValue(formData, 'policyVersion"]) assert.ok(!body.includes(forbidden));
});

void test('decision form is rendered only for server-provided authority and keeps recommendation separate', async () => {
  const source = await readFile(new URL('../../components/workspace/supplier-final-decision-panel.tsx', import.meta.url), 'utf8');
  assert.match(source, /canDecide \?/);
  assert.match(source, /evaluation\.decisionBand/);
  assert.match(source, /decision\.decision/);
  assert.doesNotMatch(source, /disabled=.*canDecide/);
});
