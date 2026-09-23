import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantId, UserId } from "../domain/ids";
import type { Supplier, ValidatedCreateSupplierInput } from "../domain/supplier";
import { ForbiddenError } from "./authorization.ts";

// Request-scoped supplier repository (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md).
// Uses the caller's own authenticated client — never a service-role client.
//
// Security correction (post-review, 2026-09-15): creation no longer goes
// through a direct table insert governed by RLS. suppliers has no
// authenticated insert policy or grant at all
// (supabase/migrations/20260914120100_suppliers.sql) — the only path is
// public.create_supplier(), a security-definer RPC that derives the actor
// from auth.uid() itself, checks supplier.manage via
// app.has_tenant_capability_as_member() (no platform-admin bypass), and
// records a mandatory audit event atomically. This repository no longer
// accepts or forwards an actor id for creation; there is nothing left for
// a caller to forge.

export class SupplierReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierReadError";
  }
}

export class SupplierWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierWriteError";
  }
}

export class DuplicateSupplierReferenceError extends Error {
  constructor(reference: string) {
    super(`A supplier with reference "${reference}" already exists in this tenant`);
    this.name = "DuplicateSupplierReferenceError";
  }
}

interface SupplierRow {
  id: string;
  tenant_id: string;
  reference: string;
  display_name: string;
  relationship_type: "supplier";
  registration_country_code: string;
  registration_identifier: string;
  industry_code: string;
  operating_country_codes: string[];
  relationship_purpose: string;
  annual_exposure_minor: number;
  annual_exposure_currency: string;
  onboarding_channel: Supplier["onboardingChannel"];
  website_domain: string | null;
  status: Supplier["status"];
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: SupplierRow): Supplier {
  return {
    id: row.id,
    tenantId: row.tenant_id as TenantId,
    reference: row.reference,
    displayName: row.display_name,
    relationshipType: row.relationship_type,
    registrationCountryCode: row.registration_country_code,
    registrationIdentifier: row.registration_identifier,
    industryCode: row.industry_code,
    operatingCountryCodes: row.operating_country_codes,
    relationshipPurpose: row.relationship_purpose,
    annualExposureMinor: row.annual_exposure_minor,
    annualExposureCurrency: row.annual_exposure_currency,
    onboardingChannel: row.onboarding_channel,
    websiteDomain: row.website_domain,
    status: row.status,
    createdBy: row.created_by as UserId,
    updatedBy: row.updated_by as UserId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SUPPLIER_COLUMNS =
  "id, tenant_id, reference, display_name, relationship_type, registration_country_code, registration_identifier, industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor, annual_exposure_currency, onboarding_channel, website_domain, status, created_by, updated_by, created_at, updated_at";

export async function createSupplier(
  client: SupabaseClient,
  tenantId: TenantId,
  input: ValidatedCreateSupplierInput,
): Promise<Supplier> {
  const { data, error } = await client.rpc("create_supplier", {
    p_tenant_id: tenantId,
    p_reference: input.reference,
    p_display_name: input.displayName,
    p_registration_country_code: input.registrationCountryCode,
    p_registration_identifier: input.registrationIdentifier,
    p_industry_code: input.industryCode,
    p_operating_country_codes: input.operatingCountryCodes,
    p_relationship_purpose: input.relationshipPurpose,
    p_annual_exposure_minor: input.annualExposureMinor,
    p_annual_exposure_currency: input.annualExposureCurrency,
    p_onboarding_channel: input.onboardingChannel,
    p_website_domain: input.websiteDomain,
  });

  if (error) {
    if (error.code === "23505") {
      throw new DuplicateSupplierReferenceError(input.reference);
    }
    if (error.code === "42501") {
      throw new ForbiddenError("supplier.manage", tenantId);
    }
    throw new SupplierWriteError(`Failed to create supplier: ${error.message}`);
  }

  return mapRow(data as SupplierRow);
}

export async function listSuppliers(client: SupabaseClient, tenantId: TenantId): Promise<Supplier[]> {
  const { data, error } = await client
    .from("suppliers")
    .select(SUPPLIER_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new SupplierReadError(`Failed to list suppliers: ${error.message}`);
  }

  return ((data ?? []) as SupplierRow[]).map(mapRow);
}

export async function getSupplierById(
  client: SupabaseClient,
  tenantId: TenantId,
  supplierId: string,
): Promise<Supplier | null> {
  const { data, error } = await client
    .from("suppliers")
    .select(SUPPLIER_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", supplierId)
    .maybeSingle();

  if (error) {
    throw new SupplierReadError(`Failed to read supplier: ${error.message}`);
  }

  return data ? mapRow(data as SupplierRow) : null;
}
