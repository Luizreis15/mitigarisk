import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { prototypeRoutesEnabled } from '../../lib/prototype-routes.ts';

void test('prototype routes are off when the variable is missing', () => {
  assert.equal(prototypeRoutesEnabled({}), false);
});

void test('prototype routes are off for any value other than "true"', () => {
  for (const value of ['', 'false', '1', 'TRUE', 'yes']) {
    assert.equal(prototypeRoutesEnabled({ ENABLE_PROTOTYPE_ROUTES: value }), false);
  }
});

void test('prototype routes are on only when explicitly enabled', () => {
  assert.equal(prototypeRoutesEnabled({ ENABLE_PROTOTYPE_ROUTES: 'true' }), true);
});

void test('no fixture prototype route lives outside the gated (prototype) group', () => {
  const prototypeDirs = new Set(
    readdirSync(new URL('../../app/(prototype)/', import.meta.url), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name),
  );
  const topLevel = readdirSync(new URL('../../app/', import.meta.url), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('('))
    .map((d) => d.name);
  for (const dir of topLevel) {
    assert.ok(!prototypeDirs.has(dir), `${dir} exists both inside and outside (prototype)`);
  }
});

void test('the gated layout calls notFound when disabled', () => {
  const source = readFileSync(new URL('../../app/(prototype)/layout.tsx', import.meta.url), 'utf8');
  assert.match(source, /prototypeRoutesEnabled\(\)/);
  assert.match(source, /notFound\(\)/);
});

void test('the sign-in page has no link into the prototype', () => {
  const source = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /href="\/tenants"/);
});
