import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const actions = read('app/workspace/access/actions.ts');

void test('the service-role client is used only after tenant.manage_members is proven', () => {
  assert.ok(actions.startsWith("'use server'"));
  const body = actions.slice(actions.indexOf('export async function inviteMemberAction'));
  const guard = body.indexOf("requestedTenantId, 'tenant.manage_members')");
  const lookup = body.indexOf('await findUserForInvitation(client,');
  const admin = body.indexOf('getServiceRoleSupabaseClient()');
  const membership = body.indexOf('await inviteMemberToTenant(client,');
  assert.ok(guard > 0 && lookup > guard && admin > lookup && membership > admin, 'guard, lookup, account, membership');
  assert.equal(actions.match(/getServiceRoleSupabaseClient\(\)/g)?.length, 1, 'one service-role use only');
});

void test('the membership itself is written with the admin session, never the service role', () => {
  assert.match(actions, /await inviteMemberToTenant\(client, \{ tenantId, userId, roleKey \}\)/);
  assert.match(actions, /await acceptInvitation\(client, identity, membershipId\)/);
});

void test('no component references the service role or the server-only client', () => {
  for (const dir of ['components/workspace', 'components/platform', 'components/auth']) {
    for (const file of readdirSync(new URL(`../../${dir}/`, import.meta.url))) {
      const source = read(`${dir}/${file}`);
      assert.doesNotMatch(source, /SERVICE_ROLE|getServiceRoleSupabase|lib\/supabase\/server/, `${dir}/${file}`);
    }
  }
});
