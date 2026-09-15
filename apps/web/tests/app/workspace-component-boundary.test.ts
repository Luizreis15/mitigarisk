import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// TASK-018: workspace presentation components must not import Supabase
// modules or privileged configuration. Values they render are server-derived.

const workspaceDir = fileURLToPath(
  new URL('../../components/workspace', import.meta.url),
);

function workspaceSources() {
  return readdirSync(workspaceDir)
    .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'))
    .map((name) => ({
      name,
      source: readFileSync(join(workspaceDir, name), 'utf8'),
    }));
}

void test('workspace components do not import Supabase modules or privileged configuration', () => {
  for (const file of workspaceSources()) {
    assert.equal(
      file.source.includes('@supabase'),
      false,
      `${file.name} must not import @supabase packages`,
    );
    assert.equal(
      file.source.includes('lib/supabase') ||
        file.source.includes('@/lib/supabase'),
      false,
      `${file.name} must not import the Supabase application boundary`,
    );
    assert.equal(
      file.source.includes('SERVICE_ROLE'),
      false,
      `${file.name} must never reference a service-role credential`,
    );
    assert.equal(
      file.source.includes('getServiceRoleSupabaseConfig'),
      false,
      `${file.name} must not call the privileged configuration helper`,
    );
  }
});

void test('workspace presentation stays server-safe and does not infer authorization from the URL', () => {
  for (const file of workspaceSources()) {
    assert.equal(
      file.source.includes('useSearchParams'),
      false,
      `${file.name} must not read authorization from URL state`,
    );
    assert.equal(
      file.source.includes('localStorage'),
      false,
      `${file.name} must not read authorization from browser storage`,
    );
  }
});

void test('supplier presentation preserves the recommendation and evidence boundaries', () => {
  const sources = Object.fromEntries(
    workspaceSources().map((file) => [file.name, file.source]),
  );
  const evaluation = sources['supplier-evaluation-panel.tsx'];
  const evidenceForm = sources['supplier-evidence-form.tsx'];
  const evidenceList = sources['supplier-evidence-list.tsx'];

  assert.match(evaluation, /recommendationNotice/);
  assert.match(evaluation, /finalDecisionPending/);
  assert.match(evaluation, /finalDecisionBody/);
  assert.match(evaluation, /evaluation\.score/);
  assert.match(evaluation, /evaluation\.decisionBand/);
  assert.doesNotMatch(evaluation, /calculate|compute|threshold/i);

  assert.doesNotMatch(evidenceForm, /type=["']file["']/);
  assert.match(evidenceForm, /evidence-form-disclosure/);
  assert.match(evidenceList, /metadataBadge/);
});

void test('supplier lists provide distinct narrow and wide presentations', () => {
  const list =
    workspaceSources().find((file) => file.name === 'supplier-list.tsx')
      ?.source ?? '';
  assert.match(list, /hidden overflow-x-auto sm:block/);
  assert.match(list, /sm:hidden/);
  assert.match(list, /focus-visible:ring-2/);
});
