import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../app/workspace/customers/[customerId]/audit-pack/page.tsx', import.meta.url), 'utf8');

void test('the audit pack requires audit.view before reading any customer data', () => {
  const tenant = source.indexOf("requestedTenantId, 'customer.view')");
  const guard = source.indexOf("hasCapability(client, tenantId, 'audit.view')");
  const deny = source.indexOf('if (!canViewAudit) redirect(');
  const firstRead = source.indexOf('getCustomerById(');
  assert.ok(tenant > 0 && guard > tenant && deny > guard && firstRead > deny, 'customer.view, then audit.view, then reads');
});

void test('every generated pack is hashed and recorded before it is shown', () => {
  const hash = source.indexOf("createHash('sha256').update(json)");
  const record = source.indexOf('await recordAuditPackGenerated(');
  const render = source.indexOf('<AuditPackToolbar');
  assert.ok(hash > 0 && record > hash && render > record);
});
