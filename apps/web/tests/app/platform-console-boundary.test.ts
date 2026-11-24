import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

void test('every platform Server Action requires a platform admin before any database call', () => {
  const source = read('app/platform/actions.ts');
  assert.ok(source.startsWith("'use server'"));
  assert.match(source, /async function requirePlatformAdmin\(\)[\s\S]*?if \(!identity\.isPlatformAdmin\) redirect\('\/workspace'\)/);
  const names = [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(names.sort(), ['createTenantAction', 'setMembershipStatusAction', 'setTenantStatusAction']);
  for (const name of names) {
    const start = source.indexOf(`export async function ${name}`);
    const end = source.indexOf('export async function', start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const guard = body.indexOf('await requirePlatformAdmin()');
    const rpc = body.search(/await (createPlatformTenant|setPlatformTenantStatus|setPlatformMembershipStatus)\(/);
    assert.ok(guard >= 0 && rpc > guard, `${name} must guard before calling the database`);
  }
});

void test('every platform page redirects non-admins before reading data', () => {
  for (const path of ['app/platform/page.tsx', 'app/platform/new/page.tsx', 'app/platform/tenants/[tenantId]/page.tsx']) {
    const source = read(path);
    const guard = source.indexOf("if (!identity.isPlatformAdmin) redirect('/workspace')");
    const firstRead = source.search(/listPlatform\w+\(client/);
    assert.ok(guard >= 0, `${path} must redirect non-admins`);
    if (firstRead >= 0) assert.ok(firstRead > guard, `${path} must guard before reading`);
  }
});

void test('the workspace sends platform admins to their console', () => {
  const source = read('app/workspace/page.tsx');
  assert.match(source, /if \(identity\.isPlatformAdmin\) \{\s*\/\/[^\n]*\n\s*redirect\('\/platform'\);/);
});

void test('the platform repository never reads tenant-operational tables', () => {
  const source = read('lib/supabase/platform-repository.ts');
  for (const table of ['customers', 'customer_assessments', 'customer_decisions', 'policy_versions', 'suppliers', 'cases']) {
    assert.doesNotMatch(source, new RegExp(`from\\('${table}'\\)`), table);
  }
});
