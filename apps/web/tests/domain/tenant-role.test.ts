import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_KEYS, TENANT_ROLE_KEYS, isTenantRoleKey } from "../../lib/domain/tenancy.ts";

void test("TENANT_ROLE_KEYS excludes platform_super_admin only", () => {
  assert.equal(TENANT_ROLE_KEYS.includes("platform_super_admin" as never), false);
  assert.equal(TENANT_ROLE_KEYS.length, ROLE_KEYS.length - 1);
  for (const key of ROLE_KEYS) {
    if (key === "platform_super_admin") continue;
    assert.equal((TENANT_ROLE_KEYS as readonly string[]).includes(key), true);
  }
});

void test("isTenantRoleKey rejects platform_super_admin and unknown keys", () => {
  assert.equal(isTenantRoleKey("platform_super_admin"), false);
  assert.equal(isTenantRoleKey("tenant_admin"), true);
  assert.equal(isTenantRoleKey("not_a_role"), false);
});
