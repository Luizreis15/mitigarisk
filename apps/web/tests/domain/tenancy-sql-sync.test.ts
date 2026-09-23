import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CAPABILITY_KEYS, ROLE_KEYS } from "../../lib/domain/tenancy.ts";

// Guards against the well-known failure mode of two hand-maintained copies
// of the same reference data (SQL seed vs. TS constants) silently drifting
// apart. See apps/web/lib/domain/tenancy.ts.
//
// Capabilities and roles are seeded once in 20260912120100_identity_and_tenancy.sql
// and may be extended by later forward-only migrations (e.g.
// 20260914120000_supplier_evaluation_capabilities.sql for TASK-023), so this
// reads every migration file rather than one hardcoded path.
const migrationsDir = fileURLToPath(new URL("../../../../supabase/migrations/", import.meta.url));

function allMigrationsSql(): string {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(`${migrationsDir}${name}`, "utf8"))
    .join("\n");
}

function extractInsertedKeys(sql: string, tableName: string): string[] {
  // Bounded by "on conflict", not the next ";": a seeded description can
  // itself contain a semicolon (e.g. platform_super_admin's "...tenants;
  // membership is not tenant-scoped."), which would truncate the block
  // after the first row if a bare ";" were used as the end marker.
  const insertMarker = `insert into public.${tableName} (key`;
  const keys: string[] = [];
  let searchFrom = 0;
  for (;;) {
    const start = sql.indexOf(insertMarker, searchFrom);
    if (start === -1) break;
    const end = sql.indexOf("on conflict", start);
    assert.ok(end >= 0, `expected an "on conflict" clause terminating the INSERT into public.${tableName} at offset ${start}`);
    const block = sql.slice(start, end);
    keys.push(...[...block.matchAll(/\('([a-z0-9_.]+)'/g)].map((m) => m[1]));
    searchFrom = end + "on conflict".length;
  }
  assert.ok(keys.length > 0, `expected at least one INSERT into public.${tableName} across all migrations`);
  return keys;
}

void test("TS capability keys match the SQL seed across all migrations", () => {
  const seeded = new Set(extractInsertedKeys(allMigrationsSql(), "capabilities"));
  assert.deepEqual([...seeded].sort(), [...CAPABILITY_KEYS].sort());
});

void test("TS role keys match the SQL seed across all migrations", () => {
  const seeded = new Set(extractInsertedKeys(allMigrationsSql(), "roles"));
  assert.deepEqual([...seeded].sort(), [...ROLE_KEYS].sort());
});

void test("risk_analyst no longer holds case.decide (TASK-023 approved decision rule)", () => {
  const sql = allMigrationsSql();
  const grantIndex = sql.indexOf("('risk_analyst', 'case.decide')");
  const deleteIndex = sql.indexOf(
    "delete from public.role_capabilities\nwhere role_key = 'risk_analyst' and capability_key = 'case.decide';",
  );
  assert.ok(grantIndex >= 0, "expected the original (now-corrected) grant to still be visible in migration history");
  assert.ok(deleteIndex > grantIndex, "expected a later forward migration to delete the risk_analyst/case.decide grant");
});
