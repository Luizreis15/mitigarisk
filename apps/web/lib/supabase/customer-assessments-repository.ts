import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorrelationId, CustomerAssessmentId, CustomerId, PolicyVersionId, TenantId, UserId } from "../domain/ids";
import type { CustomerAssessment } from "../domain/customer-assessment";
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
