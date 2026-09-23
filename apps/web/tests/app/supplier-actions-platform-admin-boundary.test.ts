import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Regression test for a real gap found on independent review: platform
// administrators must receive no operational bypass through the real
// workspace (docs/architecture/PLATFORM-ARCHITECTURE.md; docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
// acceptance criterion 9 — "No platform administrator ... produces a
// successful result"). resolveAuthorizedTenantContext alone does not
// guarantee this: a platform admin who also happens to hold a real tenant
// membership would otherwise pass tenant/capability resolution and
// succeed. Each Server Action must check identity.isPlatformAdmin itself,
// immediately after resolving identity and before doing any other work —
// this asserts on the source directly (this file needs Next.js request
// context it cannot easily construct under node --test, the same
// constraint tests/app/auth-email-boundary.test.ts documents for
// app/auth/confirm/route.ts) rather than invoking the actions.

void test('every supplier Server Action checks identity.isPlatformAdmin before resolving tenant context', async () => {
  const source = await readFile(new URL('../../app/workspace/suppliers/actions.ts', import.meta.url), 'utf8');

  const actionNames = ['createSupplierAction', 'createEvidenceAction', 'runEvaluationAction'];
  for (const name of actionNames) {
    const start = source.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, `expected to find ${name} in actions.ts`);
    const end = source.indexOf('export async function', start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);

    const identityIndex = body.indexOf('await requireAuthenticatedIdentity()');
    const guardIndex = body.indexOf('if (identity.isPlatformAdmin)');
    const tenantResolveIndex = body.indexOf('resolveAuthorizedTenantContext(');

    assert.ok(identityIndex >= 0, `${name} must resolve identity via requireAuthenticatedIdentity()`);
    assert.ok(guardIndex >= 0, `${name} must check identity.isPlatformAdmin`);
    assert.ok(
      guardIndex > identityIndex && guardIndex < tenantResolveIndex,
      `${name} must check identity.isPlatformAdmin immediately after resolving identity and before resolving tenant context`,
    );
  }
});
