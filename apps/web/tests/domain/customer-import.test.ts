import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_CHARACTERS,
  IMPORT_MAX_ROWS,
  normalizeImportChannel,
  normalizeImportDate,
  parseCustomerImport,
} from '../../lib/domain/customer-import.ts';
import { CUSTOMER_FORM_FIELDS } from '../../lib/domain/customer-form-state.ts';
import { messages } from '../../lib/i18n/messages.ts';

const HEADER = IMPORT_COLUMNS.join(',');
const appWeb = fileURLToPath(new URL('../../', import.meta.url));

function ready(text: string) {
  const result = parseCustomerImport(text);
  assert.equal(result.status, 'ready', JSON.stringify(result));
  return result.status === 'ready' ? result.rows : [];
}

void test('a clean comma file becomes validated rows with their line numbers', () => {
  const rows = ready(`${HEADER}\nC-1,Ada Fictional,1990-01-15,pt,PT,mt,non_face_to_face\nC-2,Bo Fictional,1985-06-30,DE,DE,DE,face_to_face\n`);
  assert.deepEqual(rows, [
    { line: 2, externalReference: 'C-1', fullName: 'Ada Fictional', dateOfBirth: '1990-01-15', countryOfBirth: 'PT', nationality: 'PT', residenceCountry: 'MT', onboardingChannel: 'non_face_to_face' },
    { line: 3, externalReference: 'C-2', fullName: 'Bo Fictional', dateOfBirth: '1985-06-30', countryOfBirth: 'DE', nationality: 'DE', residenceCountry: 'DE', onboardingChannel: 'face_to_face' },
  ]);
});

void test('semicolons, a BOM, CRLF, friendly headers in any order, day-first dates and blank lines are accepted', () => {
  const text = '﻿Full Name;External Reference;Date of Birth;Country of Birth;Nationality;Residence Country;Onboarding Channel;Notes\r\n\r\nAda Fictional;C-1;15/01/1990;PT;PT;MT;Non face to face;ignored\r\n';
  assert.deepEqual(ready(text), [
    { line: 3, externalReference: 'C-1', fullName: 'Ada Fictional', dateOfBirth: '1990-01-15', countryOfBirth: 'PT', nationality: 'PT', residenceCountry: 'MT', onboardingChannel: 'non_face_to_face' },
  ]);
});

void test('quoted cells keep delimiters, doubled quotes and line breaks', () => {
  const rows = ready(`${HEADER}\n"C,1","Ada ""The"" Fictional\nJr",1990-01-15,PT,PT,MT,face_to_face\nC-2,Bo,1985-06-30,DE,DE,DE,face_to_face`);
  assert.equal(rows[0].externalReference, 'C,1');
  assert.equal(rows[0].fullName, 'Ada "The" Fictional\nJr');
  assert.equal(rows[1].line, 4, 'line numbers follow the file, not the record count');
});

void test('date and channel normalisation never guess', () => {
  assert.equal(normalizeImportDate(' 1.2.1990 '), '1990-02-01');
  assert.equal(normalizeImportDate('1990/02/01'), '1990/02/01');
  assert.equal(normalizeImportDate('Feb 1 1990'), 'Feb 1 1990');
  assert.equal(normalizeImportChannel(' Face-to-Face '), 'face_to_face');
  assert.equal(normalizeImportChannel('online'), 'online');
});

void test('any invalid line refuses the whole file and every problem is listed', () => {
  const result = parseCustomerImport([
    HEADER,
    'C-1,Ada,1990-01-15,PT,PT,MT,face_to_face',
    ',No Reference,1990-01-15,PT,PT,MT,face_to_face',
    'C-3,Bad Date,1991-02-31,PT,PT,MT,face_to_face',
    'C-4,Future,2999-01-01,PT,PT,MT,face_to_face',
    'C-5,Bad Country,1990-01-15,PT,Portugal,MT,face_to_face',
    'C-6,Bad Channel,1990-01-15,PT,PT,MT,online',
    'C-1,Repeated,1990-01-15,PT,PT,MT,face_to_face',
    'C-8,Short line',
  ].join('\n'));
  assert.equal(result.status, 'row_problems');
  if (result.status !== 'row_problems') return;
  assert.equal(result.totalRows, 8);
  assert.deepEqual(result.problems, [
    { line: 3, code: 'InvalidExternalReferenceError', column: 'external_reference' },
    { line: 4, code: 'InvalidDateOfBirthError', column: 'date_of_birth' },
    { line: 5, code: 'InvalidDateOfBirthError', column: 'date_of_birth' },
    { line: 6, code: 'InvalidCustomerCountryCodeError', column: 'nationality' },
    { line: 7, code: 'InvalidCustomerOnboardingChannelError', column: 'onboarding_channel' },
    { line: 8, code: 'ImportRepeatedReferenceError', column: 'external_reference' },
    { line: 9, code: 'InvalidDateOfBirthError', column: 'date_of_birth' },
  ]);
});

void test('file-level problems are typed', () => {
  assert.deepEqual(parseCustomerImport('  \n'), { status: 'file_problem', problem: { code: 'ImportEmptyError' } });
  assert.deepEqual(parseCustomerImport(`${HEADER}\n\n`), { status: 'file_problem', problem: { code: 'ImportEmptyError' } });
  assert.deepEqual(parseCustomerImport('external_reference,full_name\nC-1,Ada'), {
    status: 'file_problem',
    problem: { code: 'ImportMissingColumnsError', columns: ['date_of_birth', 'country_of_birth', 'nationality', 'residence_country', 'onboarding_channel'] },
  });
  assert.deepEqual(parseCustomerImport(`${HEADER}\nC-1,"Ada,1990-01-15,PT,PT,MT,face_to_face`), {
    status: 'file_problem',
    problem: { code: 'ImportMalformedError', line: 2 },
  });
  assert.deepEqual(parseCustomerImport(`${HEADER}\nC-1,"Ada"x,1990-01-15,PT,PT,MT,face_to_face`), {
    status: 'file_problem',
    problem: { code: 'ImportMalformedError', line: 2 },
  });
  const line = (n: number) => `C-${n},Ada,1990-01-15,PT,PT,MT,face_to_face`;
  const many = [HEADER, ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, n) => line(n))].join('\n');
  assert.deepEqual(parseCustomerImport(many), { status: 'file_problem', problem: { code: 'ImportTooManyRowsError', rows: IMPORT_MAX_ROWS + 1 } });
  const full = [HEADER, ...Array.from({ length: IMPORT_MAX_ROWS }, (_, n) => line(n))].join('\n');
  assert.equal(ready(full).length, IMPORT_MAX_ROWS);
  assert.deepEqual(parseCustomerImport('x'.repeat(IMPORT_MAX_CHARACTERS + 1)), { status: 'file_problem', problem: { code: 'ImportTooLargeError' } });
});

void test('the import covers exactly the single-customer fields and matches the database limit', () => {
  assert.equal(IMPORT_COLUMNS.length, CUSTOMER_FORM_FIELDS.length);
  const migration = readFileSync(`${appWeb}../../supabase/migrations/20261129100000_customer_bulk_import.sql`, 'utf8');
  assert.match(migration, new RegExp(`v_count < 1 or v_count > ${IMPORT_MAX_ROWS}\\b`));
  for (const column of IMPORT_COLUMNS) {
    assert.ok(migration.includes(`v_row ->> '${column}'`), `${column} is read by the database function`);
  }
});

void test('the template parses, and every column and problem code has catalog copy', () => {
  const template = readFileSync(`${appWeb}public/templates/customers-import-template.csv`, 'utf8');
  assert.equal(ready(template).length, 2);
  assert.equal(template.split('\n')[0], HEADER);
  const copy = messages.customerWorkspace;
  assert.deepEqual(Object.keys(copy.importing.columns), [...IMPORT_COLUMNS]);
  for (const code of ['ImportEmptyError', 'ImportTooLargeError', 'ImportTooManyRowsError', 'ImportMissingColumnsError', 'ImportMalformedError', 'ImportRepeatedReferenceError', 'CustomerImportWriteError']) {
    assert.ok(Object.hasOwn(copy.errors, code), code);
  }
});
