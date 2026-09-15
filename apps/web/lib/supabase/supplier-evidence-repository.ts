import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantId, UserId } from "../domain/ids";
import type { SupplierEvidence, ValidatedCreateSupplierEvidenceInput } from "../domain/supplier-evidence";
import { ForbiddenError } from "./authorization.ts";

// Request-scoped supplier evidence repository (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md).
// Same security-definer-RPC posture as suppliers-repository.ts:
// supplier_evidence has no authenticated insert policy or grant at all
// (supabase/migrations/20260914120100_suppliers.sql) — the only path is
// public.create_supplier_evidence(), which derives the actor from
// auth.uid() itself and records a mandatory audit event atomically.

export class SupplierEvidenceReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierEvidenceReadError";
  }
}

export class SupplierEvidenceWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierEvidenceWriteError";
  }
}

export class SupplierNotFoundForEvidenceError extends Error {
  constructor(supplierId: string) {
    super(`Supplier ${supplierId} was not found in this tenant`);
    this.name = "SupplierNotFoundError";
  }
}

interface SupplierEvidenceRow {
  id: string;
  tenant_id: string;
  supplier_id: string;
  evidence_type: SupplierEvidence["evidenceType"];
  display_name: string;
  issuer_country_code: string | null;
  issue_date: string | null;
  verification_state: SupplierEvidence["verificationState"];
  digest_sha256: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

const EVIDENCE_COLUMNS =
  "id, tenant_id, supplier_id, evidence_type, display_name, issuer_country_code, issue_date, verification_state, digest_sha256, created_by, updated_by, created_at, updated_at";

function mapRow(row: SupplierEvidenceRow): SupplierEvidence {
  return {
    id: row.id,
    tenantId: row.tenant_id as TenantId,
    supplierId: row.supplier_id,
    evidenceType: row.evidence_type,
    displayName: row.display_name,
    issuerCountryCode: row.issuer_country_code,
    issueDate: row.issue_date,
    verificationState: row.verification_state,
    digestSha256: row.digest_sha256,
    createdBy: row.created_by as UserId,
    updatedBy: row.updated_by as UserId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createSupplierEvidence(
  client: SupabaseClient,
  tenantId: TenantId,
  supplierId: string,
  input: ValidatedCreateSupplierEvidenceInput,
): Promise<SupplierEvidence> {
  const { data, error } = await client.rpc("create_supplier_evidence", {
    p_tenant_id: tenantId,
    p_supplier_id: supplierId,
    p_evidence_type: input.evidenceType,
    p_display_name: input.displayName,
    p_issuer_country_code: input.issuerCountryCode,
    p_issue_date: input.issueDate,
    p_verification_state: input.verificationState,
    p_digest_sha256: input.digestSha256,
  });

  if (error) {
    if (error.code === "P0002") {
      throw new SupplierNotFoundForEvidenceError(supplierId);
    }
    if (error.code === "42501") {
      throw new ForbiddenError("supplier.manage", tenantId);
    }
    throw new SupplierEvidenceWriteError(`Failed to register supplier evidence: ${error.message}`);
  }

  return mapRow(data as SupplierEvidenceRow);
}

export async function listSupplierEvidence(
  client: SupabaseClient,
  tenantId: TenantId,
  supplierId: string,
): Promise<SupplierEvidence[]> {
  const { data, error } = await client
    .from("supplier_evidence")
    .select(EVIDENCE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new SupplierEvidenceReadError(`Failed to list supplier evidence: ${error.message}`);
  }

  return ((data ?? []) as SupplierEvidenceRow[]).map(mapRow);
}
