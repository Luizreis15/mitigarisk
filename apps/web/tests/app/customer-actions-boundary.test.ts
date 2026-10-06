import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Source-boundary tests for the customer CRA experience
// (docs/tasks/TASK-035-cursor-customer-assessment-experience.md, acceptance
// criterion 4). Server Actions and pages need Next.js request context that
// node --test cannot construct, so these assert on source text, the same
// approach as supplier-actions-platform-admin-boundary.test.ts.

const appWeb = fileURLToPath(new URL('../../', import.meta.url));
const customersDir = join(appWeb, 'app/workspace/customers');
const actionsPath = join(customersDir, 'actions.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const customerRouteFiles = filesUnder(customersDir).filter((path) => /\.(ts|tsx)$/.test(path));
const customerPageFiles = customerRouteFiles.filter((path) => path.endsWith('page.tsx'));
const customerComponentFiles = readdirSync(join(appWeb, 'components/workspace'))
  .filter((name) => name.startsWith('customer-') || name === 'workspace-customer-entry.tsx')
  .map((name) => join(appWeb, 'components/workspace', name));

const SERVICE_ROLE_MARKERS = [
  'SERVICE_ROLE',
  'getServiceRoleSupabaseClient',
  'getServiceRoleSupabaseConfig',
  'lib/supabase/server',
  'createRequestScopedSupabaseClient',
];

void test('customer actions and routes never import or reference a service-role client', () => {
  assert.ok(customerPageFiles.length >= 3, 'expected list, new, and detail pages');
  for (const path of [...customerRouteFiles, ...customerComponentFiles]) {
    const source = read(path);
    for (const marker of SERVICE_ROLE_MARKERS) {
      assert.ok(!source.includes(marker), `${relative(appWeb, path)} must not reference ${marker}`);
    }
  }
});

const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(appWeb, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

/** Every local module reachable from the entry files through static imports and re-exports. */
function reachableModules(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = stripComments(read(file));
    for (const match of source.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const target = resolveImport(file, match[1] ?? match[2]);
      if (target) queue.push(target);
    }
  }
  return seen;
}

void test('no service-role or admin client is reachable through the import graph of customer actions and pages', () => {
  const reachable = reachableModules([actionsPath, ...customerPageFiles]);
  const names = [...reachable].map((path) => relative(appWeb, path));
  assert.ok(names.includes('lib/supabase/session.ts'), 'the walk must reach the cookie-backed client');
  assert.ok(names.includes('components/workspace/customer-assessment-form.tsx'), 'the walk must follow page imports');
  assert.ok(!names.includes('lib/supabase/server.ts'), 'lib/supabase/server.ts (service role) must be unreachable');
  for (const path of reachable) {
    const name = relative(appWeb, path);
    const source = stripComments(read(path));
    assert.ok(
      !/\bcreateClient\b[^;]*from\s*['"]@supabase\/supabase-js['"]/.test(source),
      `${name} must not build a raw (non-cookie) Supabase client`,
    );
    if (name === 'lib/supabase/env.ts') continue;
    for (const marker of ['SERVICE_ROLE', 'getServiceRoleSupabaseConfig', 'getServiceRoleSupabaseClient', 'service_role']) {
      assert.ok(!source.includes(marker), `${name} is reachable from customer routes and must not reference ${marker}`);
    }
  }
});

const ALLOWED_FORM_FIELDS = new Set([
  'tenantId',
  'customerId',
  'correlationId',
  'policyVersionId',
  'externalReference',
  'fullName',
  'dateOfBirth',
  'countryOfBirth',
  'nationality',
  'residenceCountry',
  'onboardingChannel',
]);

void test('customer actions read only allow-listed FormData fields, never a score, band, or outcome', () => {
  const source = stripComments(read(actionsPath));
  const literalReads = [
    ...source.matchAll(/(?:readFormValue\(formData,\s*|formData\.get(?:All)?\(\s*)['"`]([^'"`]*)['"`]/g),
  ].map((match) => match[1]);
  assert.ok(literalReads.length >= 11, 'expected the literal field reads to be found');
  for (const field of literalReads) {
    assert.ok(ALLOWED_FORM_FIELDS.has(field), `actions must not read the "${field}" field from the browser`);
    assert.ok(!/score|band|dd_?level|outcome|override|approval|review|result/i.test(field), field);
  }
  const dynamicReads = [...source.matchAll(/formData\.(get|getAll|has)\(\s*([A-Za-z_]\w*)\s*\)/g)].map((m) => `${m[1]}(${m[2]})`);
  assert.deepEqual(dynamicReads.sort(), ['get(key)', 'getAll(name)'], 'only readFormValue and fieldReader read by variable');
  assert.match(source, /function readFormValue\(formData: FormData, key: string\)/);
  assert.match(source, /function fieldReader\(formData: FormData\): FieldReader/);
  assert.ok(!/fieldReader\(formData\)\(/.test(source), 'fieldReader is only handed to the form-bound domain helpers');
});

void test('customer actions use only the cookie-backed client and are Server Actions', () => {
  const source = read(actionsPath);
  assert.ok(source.startsWith("'use server'"), 'actions.ts must be a Server Action module');
  assert.match(source, /import \{ createServerSupabaseClient \} from '@\/lib\/supabase\/session'/);
  assert.match(source, /await createServerSupabaseClient\(\)/);
});

void test('every customer Server Action denies platform admins before resolving tenant context with a capability', () => {
  const source = read(actionsPath);
  const names = [...source.matchAll(/export async function (\w+)/g)].map((match) => match[1]);
  assert.ok(names.includes('createCustomerAction'));
  for (const name of names) {
    const start = source.indexOf(`export async function ${name}`);
    const end = source.indexOf('export async function', start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const identityIndex = body.indexOf('await requireAuthenticatedIdentity()');
    const guardIndex = body.indexOf('if (identity.isPlatformAdmin)');
    const tenantIndex = body.search(/resolveAuthorizedTenantContext\(client, identity, requestedTenantId, '(customer\.manage|assessment\.run)'\)/);
    assert.ok(identityIndex >= 0, `${name} must resolve identity`);
    assert.ok(guardIndex > identityIndex, `${name} must check identity.isPlatformAdmin after identity`);
    assert.ok(tenantIndex > guardIndex, `${name} must resolve tenant context with an explicit capability after the guard`);
  }
  assert.match(source, /resolveAuthorizedTenantContext\(client, identity, requestedTenantId, 'customer\.manage'\)/);
});

void test('customer actions never compute, derive, or forward a score, band, DD level, or outcome', () => {
  const source = read(actionsPath);
  assert.ok(!source.includes('cra-engine'), 'actions must not import the non-authoritative TypeScript engine');
  assert.ok(!/evaluateCra|calculate|compute/i.test(source.replace(/\/\/.*$/gm, '')), 'actions must not calculate anything');
  for (const forbidden of ['score', 'band', 'dd_level', 'ddLevel', 'outcome', 'overrides', 'approvals', 'review']) {
    assert.ok(
      !new RegExp(`readFormValue\\(formData, '[^']*${forbidden}`, 'i').test(source),
      `actions must not read a "${forbidden}" field from the browser`,
    );
  }
  assert.ok(!source.includes('service_role'));
});

void test('customer pages deny platform admins and gate every read on customer.view', () => {
  for (const path of customerPageFiles) {
    const source = read(path);
    const name = relative(appWeb, path);
    assert.match(source, /if \(identity\.isPlatformAdmin\) \{\s*redirect\('\/workspace'\);/, `${name} must deny platform admins`);
    assert.match(
      source,
      /resolveAuthorizedTenantContext\(client, identity, requestedTenantId, 'customer\.view'\)/,
      `${name} must require customer.view`,
    );
    assert.match(source, /hasPublicSupabaseConfig\(\)/, `${name} must fail closed without public config`);
  }
});

void test('create and assess controls render only for server-confirmed capabilities', () => {
  const list = read(join(customersDir, 'page.tsx'));
  assert.match(list, /hasCapability\(client, tenantId, 'customer\.manage'\)/);
  assert.match(list, /\{canManageCustomers \? \(/);

  const create = read(join(customersDir, 'new/page.tsx'));
  assert.match(create, /hasCapability\(client, tenantId, 'customer\.manage'\)/);
  assert.match(create, /redirect\(`\/workspace\/customers\?tenant=\$\{tenantId\}`\)/);

  const detail = read(join(customersDir, '[customerId]/page.tsx'));
  assert.match(detail, /hasCapability\(client, tenantId, 'assessment\.run'\)/);
  assert.match(detail, /if \(canRunAssessment\) \{\s*try \{\s*form = await getCustomerAssessmentForm\(client, tenantId\);/);
  assert.match(detail, /\{canRunAssessment && form \? \(\s*<CustomerAssessmentForm/);
  assert.match(detail, /\{canRunAssessment && formUnavailable \? \(/);
  assert.ok(!detail.includes('Placeholder'), 'the phase A placeholder is gone');
});

void test('runCustomerAssessmentAction forwards only facts built from the re-fetched form', () => {
  const source = read(actionsPath);
  const start = source.indexOf('export async function runCustomerAssessmentAction');
  assert.ok(start >= 0, 'runCustomerAssessmentAction must exist');
  const body = source.slice(start);
  assert.match(body, /resolveAuthorizedTenantContext\(client, identity, requestedTenantId, 'assessment\.run'\)/);
  const formIndex = body.indexOf('await getCustomerAssessmentForm(client, tenantId)');
  const factsIndex = body.indexOf('buildAssessmentFacts(form,');
  const runIndex = body.indexOf('await runCustomerAssessment(client, {');
  assert.ok(formIndex >= 0 && factsIndex > formIndex && runIndex > factsIndex, 'form re-read, then facts built, then the RPC');
  assert.match(body, /tenantId,\s*customerId: customerId as CustomerId,\s*facts,\s*correlationId: correlationId as CorrelationId,\s*\}\)/);
  for (const forbidden of ['Object.fromEntries', 'formData.entries', 'formData.keys', 'formData.forEach', 'JSON.parse']) {
    assert.ok(!source.includes(forbidden), `actions must never forward submitted keys wholesale (${forbidden})`);
  }
  assert.match(body, /readFormValue\(formData, 'policyVersionId'\) !== form\.policyVersionId/);
  assert.match(body, /redirect\('\/denied'\)/);
});

void test('the assessment correlation id is generated server-side at render', () => {
  const detail = read(join(customersDir, '[customerId]/page.tsx'));
  assert.match(detail, /import \{ randomUUID \} from 'node:crypto'/);
  assert.match(detail, /const correlationId = randomUUID\(\);/);
  const form = read(join(appWeb, 'components/workspace/customer-assessment-form.tsx'));
  assert.match(form, /<input type="hidden" name="correlationId" value=\{correlationId\} \/>/);
  assert.ok(!form.includes('randomUUID') && !form.includes('crypto.'), 'the browser never mints the correlation id');
});

void test('the assessment form never mentions weights or points', () => {
  const form = read(join(appWeb, 'components/workspace/customer-assessment-form.tsx')).replace(/\/\/.*$/gm, '');
  const view = read(join(appWeb, 'lib/i18n/customer-assessment-form.ts')).replace(/\/\/.*$/gm, '');
  for (const source of [form, view]) {
    assert.ok(!/weight|points/i.test(source));
  }
});

void test('the workspace shows the Customers entry only with server-confirmed customer.view', () => {
  const workspace = read(join(appWeb, 'app/workspace/page.tsx'));
  assert.match(workspace, /hasCapability\(client, activeTenantId, 'customer\.view'\)/);
  const experience = read(join(appWeb, 'components/workspace/workspace-experience.tsx'));
  assert.match(experience, /\{customerEntryTenantId \? \(/);
});

void test('customer presentation never imports the engine or calculates a result', () => {
  for (const path of customerComponentFiles) {
    const source = read(path).replace(/\/\/.*$/gm, '');
    const name = relative(appWeb, path);
    assert.ok(!/import \{[^}]*evaluateCra/.test(source), `${name} must not import evaluateCra`);
    assert.ok(!/calculate|compute|threshold/i.test(source), `${name} must not calculate`);
    assert.ok(!source.includes('@supabase'), `${name} must not import Supabase`);
  }
});

void test('both customer forms re-mount with the echoed values after a failed Server Action', () => {
  const create = read(join(appWeb, 'components/workspace/customer-create-form.tsx'));
  const assess = read(join(appWeb, 'components/workspace/customer-assessment-form.tsx'));
  for (const source of [create, assess]) {
    assert.match(source, /key=\{error\?\.attempt \?\? 'initial'\}/);
    assert.match(source, /customerErrorMessage\(error\.code\)/);
    assert.ok(!/errors\[[^\]]*code\]/.test(source), 'error copy goes through the own-property lookup');
  }
  assert.ok(!create.includes('noValidate'), 'native required validation stays on');
  for (const field of ['externalReference', 'fullName', 'dateOfBirth', 'countryOfBirth', 'nationality', 'residenceCountry']) {
    assert.match(create, new RegExp(`defaultValue=\\{value\\('${field}'\\)\\}`), field);
  }
  assert.match(assess, /withSubmittedValues\(view, error\?\.values\)/);
  assert.match(assess, /defaultChecked=\{override\.defaultValue === option\.value\}/);
  assert.ok(!assess.includes('aria-required'), 'a plain fieldset has no aria-required; the radios carry required');
  assert.match(assess, /\brequired\b/);
});

void test('customer presentation keeps copy in the catalog and keys lists by code and index', () => {
  const result = read(join(appWeb, 'components/workspace/customer-assessment-result.tsx'));
  const list = read(join(appWeb, 'components/workspace/customer-list.tsx'));
  const create = read(join(appWeb, 'components/workspace/customer-create-form.tsx'));
  assert.ok(!result.includes('/ 100'));
  assert.ok(!list.includes("'—'"));
  assert.ok(!create.includes('CUST-DEMO-010'));
  assert.match(result, /<span aria-hidden="true">\s*\{view\.overallScoreText\}/, 'the visible score is hidden from screen readers');
  assert.equal((result.match(/interpolate\(t\.scoreOutOf,/g) ?? []).length, 1, 'the score is announced once');
  const keys = [...result.matchAll(/key=\{(`[^`]*`|[^}]+)\}/g)].map((match) => match[1]);
  assert.ok(keys.length >= 8);
  for (const key of keys) {
    assert.match(key, /^`\$\{[\w.]+\}-\$\{index\}`$/, key);
  }
  const profile = read(join(appWeb, 'components/workspace/customer-profile.tsx'));
  assert.match(profile, /customerStatusLabel\(customer\.status\)/);
  assert.match(profile, /onboardingChannelLabel\(customer\.onboardingChannel\)/);
});
