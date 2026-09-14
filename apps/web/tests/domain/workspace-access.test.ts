import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkspaceViewModel,
  describeWorkspaceAccess,
  describeWorkspacePresentation,
  membershipCountForm,
} from "../../lib/domain/workspace-access.ts";
import { workspaceMembershipCountCopy } from "../../lib/i18n/workspace.ts";

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

void test("missing public configuration is classified before any access state", () => {
  assert.equal(
    describeWorkspacePresentation({
      publicConfigAvailable: false,
      membershipReadFailed: true,
      isPlatformAdmin: true,
      activeMembershipCount: 4,
    }),
    "config_unavailable",
  );
});

void test("a membership read failure is classified before inventing tenant access", () => {
  assert.equal(
    describeWorkspacePresentation({
      publicConfigAvailable: true,
      membershipReadFailed: true,
      isPlatformAdmin: false,
      activeMembershipCount: 2,
    }),
    "read_failure",
  );
});

void test("ready presentation reuses the access classifier", () => {
  assert.equal(
    describeWorkspacePresentation({
      publicConfigAvailable: true,
      membershipReadFailed: false,
      isPlatformAdmin: false,
      activeMembershipCount: 2,
    }),
    "active_member",
  );
});

void test("membership count form is one only for exactly one membership", () => {
  assert.equal(membershipCountForm(0), "other");
  assert.equal(membershipCountForm(1), "one");
  assert.equal(membershipCountForm(2), "other");
});

void test("membership count copy interpolates a count without inventing tenant names", () => {
  assert.equal(
    workspaceMembershipCountCopy(1, "one"),
    "1 active company membership.",
  );
  assert.equal(
    workspaceMembershipCountCopy(3, "other"),
    "3 active company memberships.",
  );
});

void test("config-unavailable view model hides session email and membership count", () => {
  const model = buildWorkspaceViewModel({
    publicConfigAvailable: false,
    membershipReadFailed: false,
    isPlatformAdmin: false,
    activeMembershipCount: 2,
    signedInEmail: "example@demo.mitiga.local",
  });
  assert.equal(model.kind, "config_unavailable");
  assert.equal(model.signedInEmail, null);
  assert.equal(model.activeMembershipCount, 0);
  assert.equal(model.showsAuthenticatedSession, false);
});

void test("authenticated view model keeps the server-derived email and count", () => {
  const model = buildWorkspaceViewModel({
    publicConfigAvailable: true,
    membershipReadFailed: false,
    isPlatformAdmin: false,
    activeMembershipCount: 1,
    signedInEmail: "example@demo.mitiga.local",
  });
  assert.equal(model.kind, "active_member");
  assert.equal(model.signedInEmail, "example@demo.mitiga.local");
  assert.equal(model.activeMembershipCount, 1);
  assert.equal(model.membershipCountForm, "one");
  assert.equal(model.showsAuthenticatedSession, true);
});
