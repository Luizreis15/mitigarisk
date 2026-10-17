import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

void test('auth confirm GET never verifies OTP (scanners must not burn the token)', async () => {
  const source = await readFile(new URL('../../app/auth/confirm/route.ts', import.meta.url), 'utf8');
  assert.match(source, /\/auth\/continue/);
  assert.match(source, /token_hash/);
  assert.match(source, /isSupportedAuthCallbackType/);
  assert.doesNotMatch(source, /client\.auth\.verifyOtp|auth\.verifyOtp|\.verifyOtp\s*\(/);
  assert.doesNotMatch(source, /SERVICE_ROLE|RESEND_API_KEY/i);
});

void test('auth continue POST path verifies hashed OTP behind an explicit human action', async () => {
  const actions = await readFile(new URL('../../app/auth-actions.ts', import.meta.url), 'utf8');
  assert.match(actions, /confirmAuthLinkAction/);
  assert.match(actions, /verifyOtp/);
  assert.match(actions, /token_hash/);
  assert.match(actions, /isSupportedAuthCallbackType/);
  assert.match(actions, /isPasswordActionCallbackType/);
  assert.match(actions, /httpOnly:\s*true/);
  assert.match(actions, /maxAge:\s*15 \* 60/);
  assert.doesNotMatch(actions, /SERVICE_ROLE|RESEND_API_KEY/i);
});

void test('auth continue page posts token fields and never imports provider secrets', async () => {
  const source = await readFile(new URL('../../app/auth/continue/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /confirmAuthLinkAction/);
  assert.match(source, /token_hash/);
  assert.doesNotMatch(source, /SERVICE_ROLE|RESEND_API_KEY/);
  // verifyOtp must live only in the POST server action, not in this page module body.
  assert.doesNotMatch(source, /client\.auth\.verifyOtp|auth\.verifyOtp/);
});

void test('client password form has no provider or secret boundary import', async () => {
  const source = await readFile(new URL('../../components/auth/update-password-form.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /supabase|resend|SERVICE_ROLE|RESEND_API_KEY/i);
});
