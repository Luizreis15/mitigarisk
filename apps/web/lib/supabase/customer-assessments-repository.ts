import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorrelationId, CustomerAssessmentId, CustomerId, PolicyVersionId, TenantId, UserId } from "../domain/ids";
import type {
  CraOverrideFactValue,
  CustomerAssessment,
  CustomerAssessmentForm,
  CustomerAssessmentFormCategory,
  CustomerAssessmentFormOverride,
} from "../domain/customer-assessment";
import type { CraResult } from "../domain/cra-engine";
import { ForbiddenError } from "./authorization.ts";

// Request-scoped wrapper around public.run_customer_assessment()
// (supabase/migrations/20260927100000_customer_assessment.sql), the one
// atomic, capability-checked, audited assessment path, plus the read paths
// for showing a persisted result back. Mirrors
// apps/web/lib/supabase/supplier-evaluations-repository.ts.
//
// No engine output of any kind is sent by this function because none
// exists to send: the caller supplies only identifying references plus the
// raw facts document, and the database itself validates the facts against
// the published policy's own structure, resolves the policy, calls the
// evaluator, and persists the result atomically.

export class CustomerAssessmentReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerAssessmentReadError";
  }
}

export class CustomerAssessmentWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerAssessmentWriteError";
  }
}

/** Same correlation id was already used for this tenant with different assessment input; a stable typed conflict, never a silently duplicated assessment. */
export class AssessmentCorrelationConflictError extends Error {
  constructor(correlationId: CorrelationId) {
    super(`Correlation id ${correlationId} was already used with different assessment input`);
    this.name = "AssessmentCorrelationConflictError";
  }
}

export class CustomerNotFoundForAssessmentError extends Error {
  constructor(customerId: CustomerId) {
    super(`Customer ${customerId} was not found in this tenant`);
    this.name = "CustomerNotFoundForAssessmentError";
  }
}

export class NoPublishedCraPolicyError extends Error {
  constructor(tenantId: TenantId) {
    super(`Tenant ${tenantId} has no published cra_v2 policy version`);
    this.name = "NoPublishedCraPolicyError";
  }
}

/** The facts document failed the database's strict intake validation (an unknown key, or an override fact that is absent, null, or not an allowed value) — closes docs/reviews/REVIEW-TASK-032.md's fail-open finding. Nothing was stored. */
export class InvalidAssessmentFactsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAssessmentFactsError";
  }
}

interface CustomerAssessmentRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  policy_version_id: string;
  facts: Record<string, unknown>;
  result: CraResult;
  overall_score: number;
  band: CraResult["band"];
  dd_level: CraResult["dd_level"];
  outcome: CraResult["outcome"];
  next_review_due: string;
  correlation_id: string;
  input_hash: string;
  assessed_by: string;
  assessed_at: string;
  created_at: string;
}

function mapRow(row: CustomerAssessmentRow): CustomerAssessment {
  return {
    id: row.id as CustomerAssessmentId,
    tenantId: row.tenant_id as TenantId,
    customerId: row.customer_id as CustomerId,
    policyVersionId: row.policy_version_id as PolicyVersionId,
    facts: row.facts,
    result: row.result,
    overallScore: row.overall_score,
    band: row.band,
    ddLevel: row.dd_level,
    outcome: row.outcome,
    nextReviewDue: row.next_review_due,
    correlationId: row.correlation_id as CorrelationId,
    inputHash: row.input_hash,
    assessedBy: row.assessed_by as UserId,
    assessedAt: row.assessed_at,
    createdAt: row.created_at,
  };
}

const CUSTOMER_ASSESSMENT_COLUMNS =
  "id, tenant_id, customer_id, policy_version_id, facts, result, overall_score, band, dd_level, outcome, next_review_due, correlation_id, input_hash, assessed_by, assessed_at, created_at";

export interface RunCustomerAssessmentInput {
  tenantId: TenantId;
  customerId: CustomerId;
  facts: Record<string, unknown>;
  correlationId: CorrelationId;
}

export async function runCustomerAssessment(
  client: SupabaseClient,
  input: RunCustomerAssessmentInput,
): Promise<CustomerAssessment> {
  const { data, error } = await client.rpc("run_customer_assessment", {
    p_tenant_id: input.tenantId,
    p_customer_id: input.customerId,
    p_facts: input.facts,
    p_correlation_id: input.correlationId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new AssessmentCorrelationConflictError(input.correlationId);
    }
    if (error.code === "P0002") {
      throw new CustomerNotFoundForAssessmentError(input.customerId);
    }
    if (error.code === "P0003") {
      throw new NoPublishedCraPolicyError(input.tenantId);
    }
    if (error.code === "22023") {
      throw new InvalidAssessmentFactsError(error.message);
    }
    if (error.code === "42501") {
      throw new ForbiddenError("assessment.run", input.tenantId);
    }
    throw new CustomerAssessmentWriteError(`Failed to run customer assessment: ${error.message}`);
  }

  return mapRow(data as CustomerAssessmentRow);
}

export async function listCustomerAssessments(
  client: SupabaseClient,
  tenantId: TenantId,
  customerId: CustomerId,
): Promise<CustomerAssessment[]> {
  const { data, error } = await client
    .from("customer_assessments")
    .select(CUSTOMER_ASSESSMENT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .order("assessed_at", { ascending: false });

  if (error) {
    throw new CustomerAssessmentReadError(`Failed to list customer assessments: ${error.message}`);
  }

  return ((data ?? []) as CustomerAssessmentRow[]).map(mapRow);
}

export async function getLatestCustomerAssessment(
  client: SupabaseClient,
  tenantId: TenantId,
  customerId: CustomerId,
): Promise<CustomerAssessment | null> {
  const { data, error } = await client
    .from("customer_assessments")
    .select(CUSTOMER_ASSESSMENT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new CustomerAssessmentReadError(`Failed to read the customer's latest assessment: ${error.message}`);
  }

  return data ? mapRow(data as CustomerAssessmentRow) : null;
}

// public.get_customer_assessment_form()
// (supabase/migrations/20261006100000_customer_assessment_form.sql): needs
// assessment.run only, so an operator (no policy.view) can build the form.
// Only the documented fields are copied into the domain shape; a payload
// that does not match it fails closed instead of reaching the UI.

interface AssessmentFormPayload {
  policy_version_id: string;
  policy_label: string;
  categories: Array<{
    key: string;
    label: string;
    position: number;
    factors: Array<{ key: string; position: number; values: string[] }>;
  }>;
  overrides: Array<{
    fact_key: string;
    values: CraOverrideFactValue[];
    negative_value: CraOverrideFactValue;
    provisional: boolean;
  }>;
}

function isOverrideValue(value: unknown): value is CraOverrideFactValue {
  return typeof value === "string" || typeof value === "boolean";
}

function isAssessmentFormPayload(data: unknown): data is AssessmentFormPayload {
  if (typeof data !== "object" || data === null) return false;
  const form = data as Record<string, unknown>;
  if (typeof form.policy_version_id !== "string" || typeof form.policy_label !== "string") return false;
  if (!Array.isArray(form.categories) || !Array.isArray(form.overrides)) return false;
  const categoriesValid = (form.categories as unknown[]).every((category) => {
    const c = category as Record<string, unknown> | null;
    return (
      typeof c === "object" &&
      c !== null &&
      typeof c.key === "string" &&
      typeof c.label === "string" &&
      typeof c.position === "number" &&
      Array.isArray(c.factors) &&
      (c.factors as unknown[]).every((factor) => {
        const f = factor as Record<string, unknown> | null;
        return (
          typeof f === "object" &&
          f !== null &&
          typeof f.key === "string" &&
          typeof f.position === "number" &&
          Array.isArray(f.values) &&
          (f.values as unknown[]).every((value) => typeof value === "string")
        );
      })
    );
  });
  const overridesValid = (form.overrides as unknown[]).every((override) => {
    const o = override as Record<string, unknown> | null;
    return (
      typeof o === "object" &&
      o !== null &&
      typeof o.fact_key === "string" &&
      Array.isArray(o.values) &&
      (o.values as unknown[]).every(isOverrideValue) &&
      isOverrideValue(o.negative_value) &&
      typeof o.provisional === "boolean"
    );
  });
  return categoriesValid && overridesValid;
}

function mapAssessmentForm(payload: AssessmentFormPayload): CustomerAssessmentForm {
  const categories: CustomerAssessmentFormCategory[] = payload.categories.map((category) => ({
    key: category.key,
    label: category.label,
    position: category.position,
    factors: category.factors.map((factor) => ({
      key: factor.key,
      position: factor.position,
      values: [...factor.values],
    })),
  }));
  const overrides: CustomerAssessmentFormOverride[] = payload.overrides.map((override) => ({
    factKey: override.fact_key,
    values: [...override.values],
    negativeValue: override.negative_value,
    provisional: override.provisional,
  }));
  return {
    policyVersionId: payload.policy_version_id as PolicyVersionId,
    policyLabel: payload.policy_label,
    categories,
    overrides,
  };
}

export async function getCustomerAssessmentForm(
  client: SupabaseClient,
  tenantId: TenantId,
): Promise<CustomerAssessmentForm> {
  const { data, error } = await client.rpc("get_customer_assessment_form", { p_tenant_id: tenantId });

  if (error) {
    if (error.code === "P0003") {
      throw new NoPublishedCraPolicyError(tenantId);
    }
    if (error.code === "42501") {
      throw new ForbiddenError("assessment.run", tenantId);
    }
    throw new CustomerAssessmentReadError(`Failed to read the customer assessment form: ${error.message}`);
  }

  if (!isAssessmentFormPayload(data)) {
    throw new CustomerAssessmentReadError("The customer assessment form returned by the database has an unexpected shape");
  }

  return mapAssessmentForm(data);
}
