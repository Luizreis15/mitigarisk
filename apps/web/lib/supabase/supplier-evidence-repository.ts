import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantId, UserId } from "../domain/ids";
import type { SupplierEvidence, ValidatedCreateSupplierEvidenceInput } from "../domain/supplier-evidence";

// Request-scoped supplier evidence repository (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md).
// Same posture as suppliers-repository.ts: caller's own authenticated
// client, supplier_evidence_insert/select RLS
// (supabase/migrations/20260914120100_suppliers.sql) is the real
// enforcement boundary, created_by/updated_by always come from the
// verified actor, never a browser-supplied value.

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
  actorUserId: UserId,
  input: ValidatedCreateSupplierEvidenceInput,
): Promise<SupplierEvidence> {
  const { data, error } = await client
    .from("supplier_evidence")
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      evidence_type: input.evidenceType,
      display_name: input.displayName,
      issuer_country_code: input.issuerCountryCode,
      issue_date: input.issueDate,
      verification_state: input.verificationState,
      digest_sha256: input.digestSha256,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select(EVIDENCE_COLUMNS)
    .single();

  if (error) {
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
