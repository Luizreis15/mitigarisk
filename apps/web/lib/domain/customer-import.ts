import {
  validateCreateCustomerInput,
  type CreateCustomerInput,
  type ValidatedCreateCustomerInput,
} from "./customer.ts";
import { customerErrorField, type CustomerFormField } from "./customer-form-state.ts";

// Bulk customer import: turns the text of a CSV file into validated rows
// for public.import_customers()
// (supabase/migrations/20261129100000_customer_bulk_import.sql).
//
// The file is refused as a whole when any row is invalid: the caller shows
// every problem with its line number and nothing is sent to the database.
// Each row goes through the same validator as the single-customer form
// (validateCreateCustomerInput), so the two paths cannot drift apart. The
// database re-checks everything; this is only the early, readable error.

export const IMPORT_MAX_ROWS = 500;
/** Upper bound on the pasted or uploaded text, well under the Server Action body limit. */
export const IMPORT_MAX_CHARACTERS = 300_000;

/** Column names of the template, in order. One per customer creation field. */
export const IMPORT_COLUMNS = [
  "external_reference",
  "full_name",
  "date_of_birth",
  "country_of_birth",
  "nationality",
  "residence_country",
  "onboarding_channel",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

const COLUMN_FIELDS: Record<ImportColumn, CustomerFormField> = {
  external_reference: "externalReference",
  full_name: "fullName",
  date_of_birth: "dateOfBirth",
  country_of_birth: "countryOfBirth",
  nationality: "nationality",
  residence_country: "residenceCountry",
  onboarding_channel: "onboardingChannel",
};

export interface ImportRow extends ValidatedCreateCustomerInput {
  /** Line number in the file, counting the header as line 1. */
  line: number;
}

export interface ImportRowProblem {
  line: number;
  /** Typed error name; the catalog turns it into copy. */
  code: string;
  column: ImportColumn | null;
}

export type ImportFileProblem =
  | { code: "ImportEmptyError" }
  | { code: "ImportTooLargeError" }
  | { code: "ImportTooManyRowsError"; rows: number }
  | { code: "ImportMissingColumnsError"; columns: ImportColumn[] }
  | { code: "ImportMalformedError"; line: number };

export type ImportParseResult =
  | { status: "ready"; rows: ImportRow[] }
  | { status: "file_problem"; problem: ImportFileProblem }
  | { status: "row_problems"; problems: ImportRowProblem[]; totalRows: number };

class MalformedCsvError extends Error {
  readonly line: number;
  constructor(line: number) {
    super(`Malformed CSV near line ${line}`);
    this.name = "MalformedCsvError";
    this.line = line;
  }
}

interface CsvRecord {
  line: number;
  cells: string[];
}

/** The header's delimiter: semicolon (spreadsheets in most European locales), tab, or comma. */
function detectDelimiter(headerLine: string): string {
  const candidates = [";", "\t", ","];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Minimal RFC 4180 reader: quoted cells, doubled quotes, and line breaks
 * inside quotes. Blank lines are skipped. Throws MalformedCsvError on an
 * unterminated quote or on text after a closing quote.
 */
function readCsv(text: string, delimiter: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const endCell = () => {
    cells.push(quoted ? cell : cell.trim());
    cell = "";
    quoted = false;
  };
  const endRecord = () => {
    endCell();
    if (cells.some((value) => value !== "")) records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      if (cell.trim() !== "" || quoted) throw new MalformedCsvError(line);
      cell = "";
      inQuotes = true;
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      if (quoted && char.trim() !== "") throw new MalformedCsvError(line);
      if (!quoted) cell += char;
    }
  }
  if (inQuotes) throw new MalformedCsvError(recordLine);
  endRecord();
  return records;
}

/** `Full Name`, `full-name`, `fullName` and `FULL_NAME` all name the full_name column. */
function normalizeHeader(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

const HEADER_LOOKUP = new Map<string, ImportColumn>(
  IMPORT_COLUMNS.map((column) => [normalizeHeader(column), column]),
);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EUROPEAN_DATE_RE = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/;

/**
 * Accepts YYYY-MM-DD or the European day-first DD/MM/YYYY (also with dots).
 * Month-first dates are never guessed. Anything else is returned untouched
 * so the shared validator rejects it.
 */
export function normalizeImportDate(value: string): string {
  const trimmed = value.trim();
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  const match = EUROPEAN_DATE_RE.exec(trimmed);
  if (!match) return trimmed;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** A real calendar day: 1991-02-31 parses in JavaScript but does not exist. */
function isRealCalendarDate(isoDate: string): boolean {
  if (!ISO_DATE_RE.test(isoDate)) return false;
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === isoDate;
}

/** `Face to face`, `face-to-face` and `FACE_TO_FACE` all mean face_to_face. */
export function normalizeImportChannel(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const FIELD_COLUMNS = new Map<CustomerFormField, ImportColumn>(
  IMPORT_COLUMNS.map((column) => [COLUMN_FIELDS[column], column]),
);

/**
 * Parses and validates the whole file. Never returns a partially valid
 * result: either every row is ready, or the problems are listed.
 */
export function parseCustomerImport(rawText: string): ImportParseResult {
  if (rawText.length > IMPORT_MAX_CHARACTERS) {
    return { status: "file_problem", problem: { code: "ImportTooLargeError" } };
  }
  const text = rawText.replace(/^﻿/, "");
  if (text.trim() === "") {
    return { status: "file_problem", problem: { code: "ImportEmptyError" } };
  }

  const headerLine = text.split(/\r?\n/).find((value) => value.trim() !== "") ?? "";
  let records: CsvRecord[];
  try {
    records = readCsv(text, detectDelimiter(headerLine));
  } catch (error) {
    const line = error instanceof MalformedCsvError ? error.line : 1;
    return { status: "file_problem", problem: { code: "ImportMalformedError", line } };
  }

  const [header, ...body] = records;
  const positions = new Map<ImportColumn, number>();
  header.cells.forEach((value, index) => {
    const column = HEADER_LOOKUP.get(normalizeHeader(value));
    if (column && !positions.has(column)) positions.set(column, index);
  });
  const missing = IMPORT_COLUMNS.filter((column) => !positions.has(column));
  if (missing.length > 0) {
    return { status: "file_problem", problem: { code: "ImportMissingColumnsError", columns: missing } };
  }
  if (body.length === 0) {
    return { status: "file_problem", problem: { code: "ImportEmptyError" } };
  }
  if (body.length > IMPORT_MAX_ROWS) {
    return { status: "file_problem", problem: { code: "ImportTooManyRowsError", rows: body.length } };
  }

  const rows: ImportRow[] = [];
  const problems: ImportRowProblem[] = [];
  const firstLineByReference = new Map<string, number>();

  for (const record of body) {
    const read = (column: ImportColumn) => record.cells[positions.get(column) as number] ?? "";
    const input: CreateCustomerInput = {
      externalReference: read("external_reference"),
      fullName: read("full_name"),
      dateOfBirth: normalizeImportDate(read("date_of_birth")),
      countryOfBirth: read("country_of_birth"),
      nationality: read("nationality"),
      residenceCountry: read("residence_country"),
      onboardingChannel: normalizeImportChannel(read("onboarding_channel")) as CreateCustomerInput["onboardingChannel"],
    };

    let validated: ValidatedCreateCustomerInput;
    try {
      validated = validateCreateCustomerInput(input);
    } catch (error) {
      const field = customerErrorField(error);
      problems.push({
        line: record.line,
        code: error instanceof Error ? error.name : "UnknownError",
        column: field ? (FIELD_COLUMNS.get(field) ?? null) : null,
      });
      continue;
    }
    if (!isRealCalendarDate(validated.dateOfBirth)) {
      problems.push({ line: record.line, code: "InvalidDateOfBirthError", column: "date_of_birth" });
      continue;
    }
    if (firstLineByReference.has(validated.externalReference)) {
      problems.push({ line: record.line, code: "ImportRepeatedReferenceError", column: "external_reference" });
      continue;
    }
    firstLineByReference.set(validated.externalReference, record.line);
    rows.push({ line: record.line, ...validated });
  }

  if (problems.length > 0) {
    return { status: "row_problems", problems, totalRows: body.length };
  }
  return { status: "ready", rows };
}

/** What the database reported for one import call. */
export interface ImportOutcome {
  created: number;
  unchanged: number;
  conflicts: { line: number | null; externalReference: string }[];
  rejected: { line: number | null; externalReference: string }[];
}
