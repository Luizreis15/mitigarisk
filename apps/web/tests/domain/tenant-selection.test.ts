import { test } from "node:test";
import assert from "node:assert/strict";
import type { TenantId } from "../../lib/domain/ids";
import {
  resolveTenantSelection,
  NoActiveTenantMembershipError,
  TenantSelectionRequiredError,
  InvalidTenantSelectionError,
  type TenantMembershipOption,
} from "../../lib/domain/tenant-selection.ts";

const TENANT_A = "10000000-0000-0000-0000-0000000000a1" as TenantId;
const TENANT_B = "10000000-0000-0000-0000-0000000000b2" as TenantId;
const TENANT_STRANGER = "10000000-0000-0000-0000-000000000fff" as TenantId;

const optionA: TenantMembershipOption = { tenantId: TENANT_A, tenantName: "Acme", tenantSlug: "acme" };
const optionB: TenantMembershipOption = { tenantId: TENANT_B, tenantName: "Beta", tenantSlug: "beta" };

void test("no active memberships is classified as no_membership regardless of a requested id", () => {
  assert.deepEqual(
    resolveTenantSelection({ activeMemberships: [], requestedTenantId: null }),
    { kind: "no_membership" },
  );
  assert.deepEqual(
    resolveTenantSelection({ activeMemberships: [], requestedTenantId: TENANT_STRANGER }),
    { kind: "no_membership" },
  );
});

void test("a single active membership with no requested id is auto-selected", () => {
  assert.deepEqual(
    resolveTenantSelection({ activeMemberships: [optionA], requestedTenantId: null }),
    { kind: "auto_selected", tenantId: TENANT_A },
  );
});

void test("a single active membership with a matching requested id is selected", () => {
  const outcome = resolveTenantSelection({ activeMemberships: [optionA], requestedTenantId: TENANT_A });
  assert.deepEqual(outcome, { kind: "selected", tenantId: TENANT_A });
});

void test("a single active membership with a mismatched requested id is invalid, never auto-selected", () => {
  assert.deepEqual(
    resolveTenantSelection({ activeMemberships: [optionA], requestedTenantId: TENANT_STRANGER }),
    { kind: "invalid_selection" },
  );
});

void test("multiple active memberships with no requested id require explicit selection", () => {
  const outcome = resolveTenantSelection({
    activeMemberships: [optionA, optionB],
    requestedTenantId: null,
  });
  assert.equal(outcome.kind, "selection_required");
  if (outcome.kind === "selection_required") {
    assert.deepEqual(outcome.options, [optionA, optionB]);
  }
});

void test("multiple active memberships with a matching requested id are selected", () => {
  assert.deepEqual(
    resolveTenantSelection({ activeMemberships: [optionA, optionB], requestedTenantId: TENANT_B }),
    { kind: "selected", tenantId: TENANT_B },
  );
});

void test("multiple active memberships with an arbitrary cross-tenant id are invalid", () => {
  assert.deepEqual(
    resolveTenantSelection({
      activeMemberships: [optionA, optionB],
      requestedTenantId: TENANT_STRANGER,
    }),
    { kind: "invalid_selection" },
  );
});

void test("a stale selection (tenant no longer an active membership) is invalid", () => {
  // Simulates a bookmarked/cached ?tenant= link for a membership that was
  // since suspended or removed and so no longer appears in activeMemberships.
  assert.deepEqual(
    resolveTenantSelection({ activeMemberships: [optionB], requestedTenantId: TENANT_A }),
    { kind: "invalid_selection" },
  );
});

void test("NoActiveTenantMembershipError, TenantSelectionRequiredError, and InvalidTenantSelectionError are distinct typed errors", () => {
  assert.ok(new NoActiveTenantMembershipError() instanceof Error);
  assert.equal(new NoActiveTenantMembershipError().name, "NoActiveTenantMembershipError");

  const selectionRequired = new TenantSelectionRequiredError([optionA, optionB]);
  assert.equal(selectionRequired.name, "TenantSelectionRequiredError");
  assert.deepEqual(selectionRequired.options, [optionA, optionB]);

  assert.equal(new InvalidTenantSelectionError().name, "InvalidTenantSelectionError");
});
