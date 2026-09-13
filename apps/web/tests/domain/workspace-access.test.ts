import { test } from "node:test";
import assert from "node:assert/strict";
import { describeWorkspaceAccess } from "../../lib/domain/workspace-access.ts";

void test("a platform admin is platform_admin regardless of membership count", () => {
  assert.equal(
    describeWorkspaceAccess({ isPlatformAdmin: true, activeMembershipCount: 0 }),
    "platform_admin",
  );
  assert.equal(
    describeWorkspaceAccess({ isPlatformAdmin: true, activeMembershipCount: 3 }),
    "platform_admin",
  );
});

void test("a non-admin with at least one active membership is active_member", () => {
  assert.equal(
    describeWorkspaceAccess({ isPlatformAdmin: false, activeMembershipCount: 1 }),
    "active_member",
  );
});

void test("a non-admin with zero active memberships never receives a tenant workspace", () => {
  assert.equal(
    describeWorkspaceAccess({ isPlatformAdmin: false, activeMembershipCount: 0 }),
    "no_membership",
  );
});
