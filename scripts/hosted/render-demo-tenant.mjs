#!/usr/bin/env node
// Renders supabase/scripts/hosted/demo-tenant-mitiga.sql into a single
// transaction, injecting the CRA template fixture and the demo account
// e-mails. Usage:
//   node scripts/hosted/render-demo-tenant.mjs <admin> <operator> <auditor> <commit|rollback> > /tmp/demo.sql
import { readFileSync } from 'node:fs';

const [admin, operator, auditor, mode] = process.argv.slice(2);
const email = /^[^\s'@]+@[^\s'@]+\.[^\s'@]+$/;
if (![admin, operator, auditor].every((value) => email.test(value ?? '')) || !['commit', 'rollback'].includes(mode)) {
  console.error('usage: render-demo-tenant.mjs <admin-email> <operator-email> <auditor-email> <commit|rollback>');
  process.exit(1);
}
if (new Set([admin, operator, auditor].map((value) => value.toLowerCase())).size !== 3) {
  console.error('The three demo accounts must be different.');
  process.exit(1);
}

const root = new URL('../../', import.meta.url);
const template = JSON.stringify(JSON.parse(readFileSync(new URL('apps/web/tests/fixtures/cra-template-v1-draft.json', root), 'utf8')));
if (template.includes('$template$')) throw new Error('Template contains the dollar-quote tag.');

const sql = readFileSync(new URL('supabase/scripts/hosted/demo-tenant-mitiga.sql', root), 'utf8')
  .replace('__TEMPLATE_JSON__', template)
  .replace('__ADMIN_EMAIL__', admin)
  .replace('__OPERATOR_EMAIL__', operator)
  .replace('__AUDITOR_EMAIL__', auditor);

process.stdout.write(`begin;\n${sql}\n${mode};\n`);
