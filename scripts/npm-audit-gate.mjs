#!/usr/bin/env node
// Fails on any high or critical advisory in the production dependency tree,
// except advisories listed in apps/web/audit-exceptions.json that have not
// expired. Run from apps/web. Fails closed when the audit output is unreadable.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BLOCKING = new Set(['high', 'critical']);
const today = new Date().toISOString().slice(0, 10);

const exceptions = JSON.parse(readFileSync('audit-exceptions.json', 'utf8')).exceptions ?? [];
const active = new Map();
let failed = false;

for (const entry of exceptions) {
  if (!entry.id || !entry.reason || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? '')) {
    console.error(`Invalid exception entry: ${JSON.stringify(entry)}`);
    failed = true;
  } else if (entry.expires < today) {
    console.error(`Exception ${entry.id} expired on ${entry.expires}. Re-review it or remove it.`);
    failed = true;
  } else {
    active.set(entry.id, entry);
  }
}

let raw;
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  raw = error.stdout;
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error('Could not parse npm audit output.');
  process.exit(1);
}
if (!report.vulnerabilities) {
  console.error('npm audit output has no vulnerabilities section.');
  process.exit(1);
}

const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities)) {
  for (const via of vulnerability.via) {
    if (typeof via === 'object' && BLOCKING.has(via.severity)) {
      const id = via.url?.split('/').pop() ?? String(via.source);
      advisories.set(id, { id, severity: via.severity, name: via.name, title: via.title });
    }
  }
}

for (const advisory of advisories.values()) {
  if (active.has(advisory.id)) {
    console.log(`Excepted ${advisory.severity} ${advisory.id} (${advisory.name}) until ${active.get(advisory.id).expires}.`);
  } else {
    console.error(`Blocking ${advisory.severity} ${advisory.id} (${advisory.name}): ${advisory.title}`);
    failed = true;
  }
}

for (const id of active.keys()) {
  if (!advisories.has(id)) console.log(`Exception ${id} no longer matches any advisory; remove it.`);
}

if (failed) process.exit(1);
console.log('Production dependency audit passed.');
