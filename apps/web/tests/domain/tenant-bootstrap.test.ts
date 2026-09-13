import { test } from "node:test";
import assert from "node:assert/strict";
import { assertValidTenantName, assertValidTenantSlug } from "../../lib/domain/tenant-bootstrap.ts";

void test("assertValidTenantSlug accepts lowercase, hyphenated slugs", () => {
  assert.doesNotThrow(() => assertValidTenantSlug("acme-corp"));
  assert.doesNotThrow(() => assertValidTenantSlug("ab"));
});

void test("assertValidTenantSlug rejects invalid slugs", () => {
  assert.throws(() => assertValidTenantSlug("a"));
  assert.throws(() => assertValidTenantSlug("Acme-Corp"));
  assert.throws(() => assertValidTenantSlug("acme_corp"));
  assert.throws(() => assertValidTenantSlug("-acme"));
  assert.throws(() => assertValidTenantSlug("acme-"));
  assert.throws(() => assertValidTenantSlug(""));
});

void test("assertValidTenantName accepts a normal name and rejects blank/oversized ones", () => {
  assert.doesNotThrow(() => assertValidTenantName("Acme Corp"));
  assert.throws(() => assertValidTenantName("   "));
  assert.throws(() => assertValidTenantName("x".repeat(201)));
});
