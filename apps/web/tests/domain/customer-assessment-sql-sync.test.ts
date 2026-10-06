import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CRA_FACTOR_VALUE_MAX_LENGTH } from "../../lib/domain/customer-assessment.ts";
import { codePointLength } from "../../lib/domain/customer-assessment-facts.ts";

// Same drift guard as tenancy-sql-sync.test.ts: the factor fact length limit
// is defined in SQL (app.cra_factor_value_max_length()) and mirrored in TS for
// the assessment form UI. A later forward-only migration may redefine the
// function, so the last definition across all migrations is the one in force.
const migrationsDir = fileURLToPath(new URL("../../../../supabase/migrations/", import.meta.url));

function allMigrationsSql(): string {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(`${migrationsDir}${name}`, "utf8"))
    .join("\n");
}

void test("TS CRA_FACTOR_VALUE_MAX_LENGTH matches app.cra_factor_value_max_length() in the latest migration defining it", () => {
  const definitions = [
    ...allMigrationsSql().matchAll(
      /create or replace function app\.cra_factor_value_max_length\(\)[\s\S]*?as \$\$\s*select (\d+);\s*\$\$;/g,
    ),
  ];
  assert.ok(definitions.length > 0, "expected app.cra_factor_value_max_length() to be defined by a migration");
  assert.equal(Number(definitions[definitions.length - 1][1]), CRA_FACTOR_VALUE_MAX_LENGTH);
});

void test("every casebook factor value fits within CRA_FACTOR_VALUE_MAX_LENGTH", () => {
  const casebook = JSON.parse(
    readFileSync(new URL("../fixtures/cra-casebook-v1.json", import.meta.url), "utf8"),
  ) as Array<{ facts: Record<string, unknown> }>;
  for (const entry of casebook) {
    for (const value of Object.values(entry.facts)) {
      if (typeof value === "string") {
        assert.ok(codePointLength(value) <= CRA_FACTOR_VALUE_MAX_LENGTH, `"${value}" exceeds the factor value limit`);
      }
    }
  }
});
