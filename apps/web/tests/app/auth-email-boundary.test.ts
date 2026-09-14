import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

void test('auth callback verifies hashed OTP and never accepts a service-role credential', async () => {
  const source = await readFile(new URL('../../app/auth/confirm/route.ts', import.meta.url), 'utf8');
  assert.match(source, /verifyOtp/);
  assert.match(source, /token_hash/);
  assert.match(source, /httpOnly:\s*true/);
  assert.match(source, /maxAge:\s*15 \* 60/);
  assert.doesNotMatch(source, /SERVICE_ROLE|RESEND_API_KEY|host/i);
});

void test('auth callback delegates OTP-type allowlisting to the tested, narrow helper rather than hand-rolling one', async () => {
  const source = await readFile(new URL('../../app/auth/confirm/route.ts', import.meta.url), 'utf8');
  assert.match(source, /isSupportedAuthCallbackType/);
  assert.match(source, /isPasswordActionCallbackType/);
  // A hand-rolled allowlist here (a Set literal, a switch) would bypass
  // tests/supabase/site-url.test.ts's coverage of which OTP types are
  // accepted; this route must have exactly one such allowlist in the
  // codebase, not a second, possibly-inconsistent one.
  assert.doesNotMatch(source, /new Set/);
});

void test('client password form has no provider or secret boundary import', async () => {
  const source = await readFile(new URL('../../components/auth/update-password-form.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /supabase|resend|SERVICE_ROLE|RESEND_API_KEY/i);
});
