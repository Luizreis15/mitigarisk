import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransitionMembershipStatus } from "../../lib/domain/tenancy.ts";

void test("invited -> active is allowed by self or admin, denied otherwise", () => {
  assert.equal(
    canTransitionMembershipStatus("invited", "active", { isSelf: true, isAdmin: false }),
    true,
  );
  assert.equal(
    canTransitionMembershipStatus("invited", "active", { isSelf: false, isAdmin: true }),
    true,
  );
  assert.equal(
    canTransitionMembershipStatus("invited", "active", { isSelf: false, isAdmin: false }),
    false,
  );
});

void test("every other transition requires admin, even for self", () => {
  assert.equal(
    canTransitionMembershipStatus("active", "suspended", { isSelf: true, isAdmin: false }),
    false,
  );
  assert.equal(
    canTransitionMembershipStatus("active", "suspended", { isSelf: false, isAdmin: true }),
    true,
  );
  assert.equal(
    canTransitionMembershipStatus("suspended", "active", { isSelf: true, isAdmin: false }),
    false,
  );
  assert.equal(
    canTransitionMembershipStatus("invited", "removed", { isSelf: true, isAdmin: false }),
    false,
  );
});

void test("a no-op transition is never allowed", () => {
  assert.equal(
    canTransitionMembershipStatus("active", "active", { isSelf: true, isAdmin: true }),
    false,
  );
});
