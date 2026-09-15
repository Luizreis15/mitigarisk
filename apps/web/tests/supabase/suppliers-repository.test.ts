import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupplier,
  listSuppliers,
  getSupplierById,
  DuplicateSupplierReferenceError,
  SupplierWriteError,
  SupplierReadError,
} from "../../lib/supabase/suppliers-repository.ts";
import type { TenantId, UserId } from "../../lib/domain/ids.ts";
import type { ValidatedCreateSupplierInput } from "../../lib/domain/supplier.ts";

const TENANT_ID = "10000000-0000-0000-0000-000000000001" as TenantId;
const USER_ID = "00000000-0000-0000-0000-000000000002" as UserId;

const VALIDATED_INPUT: ValidatedCreateSupplierInput = {
  reference: "SUP-ATLAS-001",
  displayName: "Atlas Components Ltd.",
  registrationCountryCode: "MT",
  registrationIdentifier: "C-FICTIONAL-1042",
  industryCode: "industrial_components",
  operatingCountryCodes: ["MT", "IT"],
  relationshipPurpose: "Supply of replacement components for operational equipment.",
  annualExposureMinor: 24_000_000,
  annualExposureCurrency: "EUR",
  onboardingChannel: "assisted",
  websiteDomain: "atlas-components.example",
};

const ROW = {
  id: "40000000-0000-0000-0000-000000000001",
  tenant_id: TENANT_ID,
  reference: "SUP-ATLAS-001",
  display_name: "Atlas Components Ltd.",
  relationship_type: "supplier" as const,
  registration_country_code: "MT",
  registration_identifier: "C-FICTIONAL-1042",
  industry_code: "industrial_components",
  operating_country_codes: ["MT", "IT"],
  relationship_purpose: "Supply of replacement components for operational equipment.",
  annual_exposure_minor: 24_000_000,
  annual_exposure_currency: "EUR",
  onboarding_channel: "assisted" as const,
  website_domain: "atlas-components.example",
  status: "draft" as const,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z",
};

function fakeInsertClient(result: { data: unknown; error: unknown }) {
  const calls: { insertPayload?: unknown } = {};
  const builder = Object.assign(Promise.resolve(result), {
    select: (_columns: string) => builder,
    single: () => Promise.resolve(result),
  });
  const client = {
    from: (_table: string) => ({
      insert: (payload: unknown) => {
        calls.insertPayload = payload;
        return builder;
      },
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

function fakeSelectClient(result: { data: unknown; error: unknown }) {
  const calls: { eqCalls: Array<[string, unknown]> } = { eqCalls: [] };
  const builder = Object.assign(Promise.resolve(result), {
    select: (_columns: string) => builder,
    eq: (column: string, value: unknown) => {
      calls.eqCalls.push([column, value]);
      return builder;
    },
    order: (_column: string, _opts: unknown) => builder,
    maybeSingle: () => Promise.resolve(result),
  });
  const client = { from: (_table: string) => builder } as unknown as SupabaseClient;
  return { client, calls };
}

void test("createSupplier sends created_by/updated_by from the verified actor, never from input", async () => {
  const { client, calls } = fakeInsertClient({ data: ROW, error: null });
  await createSupplier(client, TENANT_ID, USER_ID, VALIDATED_INPUT);
  const payload = calls.insertPayload as Record<string, unknown>;
  assert.equal(payload.created_by, USER_ID);
  assert.equal(payload.updated_by, USER_ID);
  assert.equal(payload.tenant_id, TENANT_ID);
});

void test("createSupplier maps a unique-violation to DuplicateSupplierReferenceError", async () => {
  const { client } = fakeInsertClient({ data: null, error: { code: "23505", message: "duplicate key" } });
  await assert.rejects(
    () => createSupplier(client, TENANT_ID, USER_ID, VALIDATED_INPUT),
    DuplicateSupplierReferenceError,
  );
});

void test("createSupplier maps any other database error to SupplierWriteError", async () => {
  const { client } = fakeInsertClient({ data: null, error: { code: "42501", message: "insufficient_privilege" } });
  await assert.rejects(() => createSupplier(client, TENANT_ID, USER_ID, VALIDATED_INPUT), SupplierWriteError);
});

void test("createSupplier maps the returned row back to the domain Supplier shape", async () => {
  const { client } = fakeInsertClient({ data: ROW, error: null });
  const supplier = await createSupplier(client, TENANT_ID, USER_ID, VALIDATED_INPUT);
  assert.equal(supplier.reference, "SUP-ATLAS-001");
  assert.deepEqual(supplier.operatingCountryCodes, ["MT", "IT"]);
  assert.equal(supplier.status, "draft");
});

void test("listSuppliers filters by tenant_id", async () => {
  const { client, calls } = fakeSelectClient({ data: [ROW], error: null });
  const result = await listSuppliers(client, TENANT_ID);
  assert.deepEqual(calls.eqCalls, [["tenant_id", TENANT_ID]]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, ROW.id);
});

void test("listSuppliers fails closed with a typed error on a database error", async () => {
  const { client } = fakeSelectClient({ data: null, error: { message: "connection reset" } });
  await assert.rejects(() => listSuppliers(client, TENANT_ID), SupplierReadError);
});

void test("getSupplierById scopes the lookup to both tenant_id and id, and returns null when absent", async () => {
  const { client, calls } = fakeSelectClient({ data: null, error: null });
  const result = await getSupplierById(client, TENANT_ID, "missing-id");
  assert.deepEqual(calls.eqCalls, [
    ["tenant_id", TENANT_ID],
    ["id", "missing-id"],
  ]);
  assert.equal(result, null);
});
