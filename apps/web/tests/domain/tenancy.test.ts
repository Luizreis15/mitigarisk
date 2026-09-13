import { test } from "node:test";
import assert from "node:assert/strict";
import { CAPABILITY_KEYS, ROLE_KEYS, isCapabilityKey, isRoleKey } from "../../lib/domain/tenancy.ts";

void test("isCapabilityKey/isRoleKey accept only known keys", () => {
  for (const key of CAPABILITY_KEYS) assert.equal(isCapabilityKey(key), true);
  for (const key of ROLE_KEYS) assert.equal(isRoleKey(key), true);
  assert.equal(isCapabilityKey("not.a.capability"), false);
  assert.equal(isRoleKey("not_a_role"), false);
});

void test("capability and role key lists have no duplicates", () => {
  assert.equal(new Set(CAPABILITY_KEYS).size, CAPABILITY_KEYS.length);
  assert.equal(new Set(ROLE_KEYS).size, ROLE_KEYS.length);
});
