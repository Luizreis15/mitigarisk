import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthConfirmUrl, getSiteOrigin, safeAuthDestination } from '../../lib/supabase/site-url.ts';

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
