import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupplierEvidence,
  listSupplierEvidence,
  SupplierEvidenceReadError,
  SupplierEvidenceWriteError,
  SupplierNotFoundForEvidenceError,
} from "../../lib/supabase/supplier-evidence-repository.ts";
import { ForbiddenError } from "../../lib/supabase/authorization.ts";
import type { TenantId, UserId } from "../../lib/domain/ids.ts";
import type { ValidatedCreateSupplierEvidenceInput } from "../../lib/domain/supplier-evidence.ts";

const TENANT_ID = "10000000-0000-0000-0000-000000000003" as TenantId;
const USER_ID = "00000000-0000-0000-0000-000000000002" as UserId;
const SUPPLIER_ID = "40000000-0000-0000-0000-000000000001";

const VALIDATED_INPUT: ValidatedCreateSupplierEvidenceInput = {
  evidenceType: "compliance_questionnaire",
  displayName: "Atlas fictional compliance questionnaire",
  issuerCountryCode: "MT",
  issueDate: "2026-01-15",
  verificationState: "reviewed",
  digestSha256: "a".repeat(64),
};

const ROW = {
  id: "41000000-0000-0000-0000-000000000001",
  tenant_id: TENANT_ID,
  supplier_id: SUPPLIER_ID,
  evidence_type: "compliance_questionnaire" as const,
  display_name: "Atlas fictional compliance questionnaire",
  issuer_country_code: "MT",
  issue_date: "2026-01-15",
  verification_state: "reviewed" as const,
  digest_sha256: "a".repeat(64),
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z",
};

function fakeRpcClient(result: { data: unknown; error: unknown }) {
  const calls: { name?: string; params?: unknown } = {};
  const client = {
    rpc: (name: string, params: unknown) => {
      calls.name = name;
      calls.params = params;
      return Promise.resolve(result);
    },
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
  });
  const client = { from: (_table: string) => builder } as unknown as SupabaseClient;
  return { client, calls };
}

void test("createSupplierEvidence calls the create_supplier_evidence RPC with no actor id of any kind", async () => {
  const { client, calls } = fakeRpcClient({ data: ROW, error: null });
  await createSupplierEvidence(client, TENANT_ID, SUPPLIER_ID, VALIDATED_INPUT);
  assert.equal(calls.name, "create_supplier_evidence");
  const params = calls.params as Record<string, unknown>;
  assert.equal(params.p_tenant_id, TENANT_ID);
  assert.equal(params.p_supplier_id, SUPPLIER_ID);
  assert.equal(params.p_digest_sha256, VALIDATED_INPUT.digestSha256);
  assert.equal("p_created_by" in params, false);
});

void test("createSupplierEvidence maps a P0002 error to SupplierNotFoundForEvidenceError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "P0002", message: "not found" } });
  await assert.rejects(
    () => createSupplierEvidence(client, TENANT_ID, SUPPLIER_ID, VALIDATED_INPUT),
    SupplierNotFoundForEvidenceError,
  );
});

void test("createSupplierEvidence maps a missing-capability error to ForbiddenError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "42501", message: "insufficient_privilege" } });
  await assert.rejects(() => createSupplierEvidence(client, TENANT_ID, SUPPLIER_ID, VALIDATED_INPUT), ForbiddenError);
});

void test("createSupplierEvidence maps any other database error to SupplierEvidenceWriteError", async () => {
  const { client } = fakeRpcClient({ data: null, error: { code: "08006", message: "connection failure" } });
  await assert.rejects(
    () => createSupplierEvidence(client, TENANT_ID, SUPPLIER_ID, VALIDATED_INPUT),
    SupplierEvidenceWriteError,
  );
});

void test("createSupplierEvidence maps the returned row back to the domain shape", async () => {
  const { client } = fakeRpcClient({ data: ROW, error: null });
  const evidence = await createSupplierEvidence(client, TENANT_ID, SUPPLIER_ID, VALIDATED_INPUT);
  assert.equal(evidence.evidenceType, "compliance_questionnaire");
  assert.equal(evidence.verificationState, "reviewed");
});

void test("listSupplierEvidence scopes the lookup to both tenant_id and supplier_id", async () => {
  const { client, calls } = fakeSelectClient({ data: [ROW], error: null });
  const result = await listSupplierEvidence(client, TENANT_ID, SUPPLIER_ID);
  assert.deepEqual(calls.eqCalls, [
    ["tenant_id", TENANT_ID],
    ["supplier_id", SUPPLIER_ID],
  ]);
  assert.equal(result.length, 1);
});

void test("listSupplierEvidence fails closed with a typed error on a database error", async () => {
  const { client } = fakeSelectClient({ data: null, error: { message: "connection reset" } });
  await assert.rejects(() => listSupplierEvidence(client, TENANT_ID, SUPPLIER_ID), SupplierEvidenceReadError);
});
