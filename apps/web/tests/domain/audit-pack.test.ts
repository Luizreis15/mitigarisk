import assert from 'node:assert/strict';
import test from 'node:test';

import { AUDIT_PACK_FORMAT, buildAuditPack, canonicalJson } from '../../lib/domain/audit-pack.ts';

const input = {
  generatedAt: '2026-11-24T10:00:00Z',
  generatedBy: 'u1',
  tenant: { id: 't1', name: 'Demo' },
  customer: { id: 'c1', full_name: 'A' },
  assessments: [{ id: 'a2', assessed_at: '2026-11-02' }, { id: 'a1', assessed_at: '2026-11-01' }],
  decisions: [],
  transactionChecks: [{ id: 'k1', checked_at: '2026-11-03' }],
  actionCompletions: [],
  auditTrail: [{ id: 'e2', occurred_at: '2026-11-02' }, { id: 'e1', occurred_at: '2026-11-01' }],
};

void test('sections are ordered by their own timestamps', () => {
  const pack = buildAuditPack(input);
  assert.equal(pack.format, AUDIT_PACK_FORMAT);
  assert.deepEqual(pack.assessments.map((a) => a.id), ['a1', 'a2']);
  assert.deepEqual(pack.audit_trail.map((e) => e.id), ['e1', 'e2']);
});

void test('building does not reorder the caller arrays', () => {
  buildAuditPack(input);
  assert.deepEqual(input.assessments.map((a) => a.id), ['a2', 'a1']);
});

void test('canonical JSON is independent of key insertion order', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } }), canonicalJson({ a: { c: [{ y: 2, z: 1 }], d: 2 }, b: 1 }));
  assert.match(canonicalJson({ b: 1, a: 2 }), /^\{\n {2}"a": 2,\n {2}"b": 1\n\}$/);
});
