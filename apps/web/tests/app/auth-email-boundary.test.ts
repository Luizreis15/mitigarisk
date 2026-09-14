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

void test('client password form has no provider or secret boundary import', async () => {
  const source = await readFile(new URL('../../components/auth/update-password-form.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /supabase|resend|SERVICE_ROLE|RESEND_API_KEY/i);
});
