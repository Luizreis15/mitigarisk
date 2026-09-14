import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuthConfirmUrl,
  getSiteOrigin,
  isPasswordActionCallbackType,
  isSupportedAuthCallbackType,
  safeAuthDestination,
} from '../../lib/supabase/site-url.ts';

void test('configured production origin wins and is normalized', () => {
  assert.equal(
    getSiteOrigin({ NEXT_PUBLIC_SITE_URL: 'https://mitiga.online/path' }),
    'https://mitiga.online',
  );
  assert.equal(
    getAuthConfirmUrl({ NEXT_PUBLIC_SITE_URL: 'mitiga.online' }),
    'https://mitiga.online/auth/confirm',
  );
});

void test('Vercel origins are supported without trusting request headers', () => {
  assert.equal(
    getSiteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'mitiga.online' }),
    'https://mitiga.online',
  );
  assert.equal(getSiteOrigin({ VERCEL_URL: 'preview.example.vercel.app' }), 'https://preview.example.vercel.app');
});

void test('auth destinations reject external and unknown redirects', () => {
  assert.equal(safeAuthDestination('/workspace'), '/workspace');
  assert.equal(safeAuthDestination('/update-password'), '/update-password');
  assert.equal(safeAuthDestination('https://attacker.example'), '/update-password');
  assert.equal(safeAuthDestination('//attacker.example'), '/update-password');
  assert.equal(safeAuthDestination('/company'), '/update-password');
});

void test('only the three callback types this app issues links for are accepted', () => {
  assert.equal(isSupportedAuthCallbackType('recovery'), true);
  assert.equal(isSupportedAuthCallbackType('invite'), true);
  assert.equal(isSupportedAuthCallbackType('signup'), true);
});

void test('every other Supabase EmailOtpType is rejected, even ones this project never enabled', () => {
  // magiclink/email_change/email are real Supabase OTP types this callback
  // must never accept: this project does not enable magic link, phone,
  // SSO, or MFA, and has no template for any of these three
  // (docs/tasks/TASK-022-codex-auth-email-and-password-completion.md).
  assert.equal(isSupportedAuthCallbackType('magiclink'), false);
  assert.equal(isSupportedAuthCallbackType('email_change'), false);
  assert.equal(isSupportedAuthCallbackType('email'), false);
  assert.equal(isSupportedAuthCallbackType('sms'), false);
});

void test('a missing, empty, or arbitrary type value is rejected, not silently coerced', () => {
  assert.equal(isSupportedAuthCallbackType(null), false);
  assert.equal(isSupportedAuthCallbackType(''), false);
  assert.equal(isSupportedAuthCallbackType('RECOVERY'), false);
  assert.equal(isSupportedAuthCallbackType('recovery; drop table users'), false);
});

void test('only recovery and invite gate entry to the password-action cookie/page', () => {
  assert.equal(isPasswordActionCallbackType('recovery'), true);
  assert.equal(isPasswordActionCallbackType('invite'), true);
  assert.equal(isPasswordActionCallbackType('signup'), false);
});
