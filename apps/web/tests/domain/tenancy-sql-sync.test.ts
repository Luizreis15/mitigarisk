import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CAPABILITY_KEYS, ROLE_KEYS } from "../../lib/domain/tenancy.ts";

// Guards against the well-known failure mode of two hand-maintained copies
// of the same reference data (SQL seed vs. TS constants) silently drifting
// apart. See apps/web/lib/domain/tenancy.ts.
const migrationPath = fileURLToPath(
  new URL(
    "../../../../supabase/migrations/20260912120100_identity_and_tenancy.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8");

function extractInsertedKeys(sql: string, tableName: string): string[] {
  const insertMarker = `insert into public.${tableName} (key`;
  const start = sql.indexOf(insertMarker);
  assert.ok(start >= 0, `expected an INSERT into public.${tableName} in the migration`);
  const end = sql.indexOf("on conflict", start);
  const block = sql.slice(start, end === -1 ? undefined : end);
  return [...block.matchAll(/\('([a-z0-9_.]+)'/g)].map((m) => m[1]);
}

void test("TS capability keys match the SQL seed", () => {
  const seeded = extractInsertedKeys(sql, "capabilities");
  assert.deepEqual([...seeded].sort(), [...CAPABILITY_KEYS].sort());
});

void test("TS role keys match the SQL seed", () => {
  const seeded = extractInsertedKeys(sql, "roles");
  assert.deepEqual([...seeded].sort(), [...ROLE_KEYS].sort());
});
