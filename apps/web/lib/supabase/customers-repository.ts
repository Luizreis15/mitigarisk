import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerId, TenantId, UserId } from "../domain/ids";
import type { Customer, ValidatedCreateCustomerInput } from "../domain/customer";
import type { ImportOutcome, ImportRow } from "../domain/customer-import";
import { ForbiddenError } from "./authorization.ts";

// Request-scoped customer repository (docs/tasks/TASK-033-claude-customer-assessment.md).
// Uses the caller's own authenticated client — never a service-role client.
//
// Mirrors apps/web/lib/supabase/suppliers-repository.ts: customers has no
// authenticated insert/update/delete policy or grant at all
// (supabase/migrations/20260927100000_customer_assessment.sql) — the only
// write path is public.create_customer(), a security-definer RPC that
// derives the actor from auth.uid() itself, checks customer.manage via
// app.has_tenant_capability_as_member() (no platform-admin bypass), and
// records a mandatory audit event atomically. It is idempotent on
// (tenant_id, external_reference): an identical replay returns the
// existing row; a replay with different data is a stable conflict.

export class CustomerReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerReadError";
  }
}

export class CustomerWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerWriteError";
  }
}

/** The external reference already exists for this tenant with different data — a stable typed conflict, never a silent overwrite. */
export class DuplicateCustomerReferenceError extends Error {
  constructor(externalReference: string) {
    super(`A customer with reference "${externalReference}" already exists in this tenant with different data`);
    this.name = "DuplicateCustomerReferenceError";
  }
}

interface CustomerRow {
  id: string;
  tenant_id: string;
  external_reference: string;
  full_name: string;
  date_of_birth: string;
  country_of_birth: string;
  nationality: string;
  residence_country: string;
  onboarding_channel: Customer["onboardingChannel"];
  status: Customer["status"];
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: CustomerRow): Customer {
  return {
    id: row.id as CustomerId,
    tenantId: row.tenant_id as TenantId,
    externalReference: row.external_reference,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    countryOfBirth: row.country_of_birth,
    nationality: row.nationality,
    residenceCountry: row.residence_country,
    onboardingChannel: row.onboarding_channel,
    status: row.status,
    createdBy: row.created_by as UserId,
    updatedBy: row.updated_by as UserId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CUSTOMER_COLUMNS =
  "id, tenant_id, external_reference, full_name, date_of_birth, country_of_birth, nationality, residence_country, onboarding_channel, status, created_by, updated_by, created_at, updated_at";

export async function createCustomer(
  client: SupabaseClient,
  tenantId: TenantId,
  input: ValidatedCreateCustomerInput,
): Promise<Customer> {
  const { data, error } = await client.rpc("create_customer", {
    p_tenant_id: tenantId,
    p_external_reference: input.externalReference,
    p_full_name: input.fullName,
    p_date_of_birth: input.dateOfBirth,
    p_country_of_birth: input.countryOfBirth,
    p_nationality: input.nationality,
    p_residence_country: input.residenceCountry,
    p_onboarding_channel: input.onboardingChannel,
  });

  if (error) {
    if (error.code === "23505") {
      throw new DuplicateCustomerReferenceError(input.externalReference);
    }
    if (error.code === "42501") {
      throw new ForbiddenError("customer.manage", tenantId);
    }
    throw new CustomerWriteError(`Failed to create customer: ${error.message}`);
  }

  return mapRow(data as CustomerRow);
}

export async function listCustomers(client: SupabaseClient, tenantId: TenantId): Promise<Customer[]> {
  const { data, error } = await client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new CustomerReadError(`Failed to list customers: ${error.message}`);
  }

  return ((data ?? []) as CustomerRow[]).map(mapRow);
}

export async function getCustomerById(
  client: SupabaseClient,
  tenantId: TenantId,
  customerId: CustomerId,
): Promise<Customer | null> {
  const { data, error } = await client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw new CustomerReadError(`Failed to read customer: ${error.message}`);
  }

  return data ? mapRow(data as CustomerRow) : null;
}

/** The bulk import failed as a whole (nothing stored): transport error or a refused batch shape. */
export class CustomerImportWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerImportWriteError";
  }
}

interface ImportRpcLine {
  line: number | null;
  external_reference: string;
}

interface ImportRpcResult {
  created: number;
  unchanged: number;
  conflicts: ImportRpcLine[];
  rejected: ImportRpcLine[];
}

/**
 * Registers a validated file in one call to public.import_customers()
 * (supabase/migrations/20261129100000_customer_bulk_import.sql), which loops
 * public.create_customer(): same capability check, provenance, per-customer
 * audit event and idempotency as createCustomer above.
 */
export async function importCustomers(
  client: SupabaseClient,
  tenantId: TenantId,
  rows: ImportRow[],
): Promise<ImportOutcome> {
  const { data, error } = await client.rpc("import_customers", {
    p_tenant_id: tenantId,
    p_rows: rows.map((row) => ({
      line: row.line,
      external_reference: row.externalReference,
      full_name: row.fullName,
      date_of_birth: row.dateOfBirth,
      country_of_birth: row.countryOfBirth,
      nationality: row.nationality,
      residence_country: row.residenceCountry,
      onboarding_channel: row.onboardingChannel,
    })),
  });

  if (error) {
    if (error.code === "42501") {
      throw new ForbiddenError("customer.manage", tenantId);
    }
    throw new CustomerImportWriteError(`Failed to import customers: ${error.message}`);
  }

  const result = data as ImportRpcResult;
  const mapLine = (item: ImportRpcLine) => ({ line: item.line, externalReference: item.external_reference });
  return {
    created: result.created,
    unchanged: result.unchanged,
    conflicts: (result.conflicts ?? []).map(mapLine),
    rejected: (result.rejected ?? []).map(mapLine),
  };
}
