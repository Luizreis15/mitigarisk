import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEMO_ROLES,
  demoAccessToken,
  findDemoRole,
  isDemoAccessCookieValid,
  isDemoSwitcherEnabled,
  timingSafeEqualStrings,
} from '../../lib/demo-switcher.ts';

const enabledEnv = {
  DEMO_ROLE_SWITCHER: 'true',
  DEMO_ACCESS_CODE: 'test-code-123',
  DEMO_ACCOUNTS_PASSWORD: 'demo-password-long-enough',
};

void test('switcher is off by default', () => {
  assert.equal(isDemoSwitcherEnabled({}), false);
});

void test('switcher stays off unless every variable is set and strong enough', () => {
  assert.equal(isDemoSwitcherEnabled({ ...enabledEnv, DEMO_ROLE_SWITCHER: '1' }), false);
  assert.equal(isDemoSwitcherEnabled({ ...enabledEnv, DEMO_ACCESS_CODE: 'short' }), false);
  assert.equal(isDemoSwitcherEnabled({ ...enabledEnv, DEMO_ACCOUNTS_PASSWORD: 'short' }), false);
  assert.equal(isDemoSwitcherEnabled({ ...enabledEnv, DEMO_ACCESS_CODE: undefined }), false);
  assert.equal(isDemoSwitcherEnabled(enabledEnv), true);
});

void test('access cookie is valid only for the current code and only while enabled', async () => {
  const token = await demoAccessToken(enabledEnv.DEMO_ACCESS_CODE);
  assert.equal(await isDemoAccessCookieValid(token, enabledEnv), true);
  assert.equal(await isDemoAccessCookieValid(token, { ...enabledEnv, DEMO_ACCESS_CODE: 'rotated-code-456' }), false);
  assert.equal(await isDemoAccessCookieValid(token, { ...enabledEnv, DEMO_ROLE_SWITCHER: 'false' }), false);
  assert.equal(await isDemoAccessCookieValid(undefined, enabledEnv), false);
  assert.equal(await isDemoAccessCookieValid(enabledEnv.DEMO_ACCESS_CODE, enabledEnv), false);
});

void test('the cookie never contains the access code itself', async () => {
  const token = await demoAccessToken(enabledEnv.DEMO_ACCESS_CODE);
  assert.ok(!token.includes(enabledEnv.DEMO_ACCESS_CODE));
  assert.match(token, /^[0-9a-f]{64}$/);
});

void test('only known roles resolve, each to a dedicated demo account', () => {
  assert.equal(findDemoRole('tenant_admin')?.email, 'demo.owner@mitiga.online');
  assert.equal(findDemoRole('integration_developer'), null);
  assert.equal(findDemoRole("'; drop table"), null);
  for (const role of DEMO_ROLES) assert.match(role.email, /^demo\.[a-z]+@mitiga\.online$/);
  assert.equal(new Set(DEMO_ROLES.map((r) => r.email)).size, DEMO_ROLES.length);
});

void test('timingSafeEqualStrings compares exactly', () => {
  assert.equal(timingSafeEqualStrings('abc', 'abc'), true);
  assert.equal(timingSafeEqualStrings('abc', 'abd'), false);
  assert.equal(timingSafeEqualStrings('abc', 'abcd'), false);
});

void test('server actions re-check the gate and the cookie before signing in', () => {
  const source = readFileSync(new URL('../../app/demo-actions.ts', import.meta.url), 'utf8');
  assert.match(source, /^'use server';/);
  const signIn = source.slice(source.indexOf('export async function demoSignInAction'));
  assert.ok(signIn.indexOf('isDemoSwitcherEnabled()') < signIn.indexOf('signInWithPassword'));
  assert.ok(signIn.indexOf('isDemoAccessCookieValid') < signIn.indexOf('signInWithPassword'));
});

void test('the demo password never reaches client code', () => {
  const client = readFileSync(new URL('../../components/auth/demo-role-switcher.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(client, /DEMO_ACCOUNTS_PASSWORD|DEMO_ACCESS_CODE|process\.env/);
});
