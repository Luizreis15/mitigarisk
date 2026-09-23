'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { resolveActiveTenantContext } from '@/lib/supabase/tenant-context';
import { createSupplier, getSupplierById } from '@/lib/supabase/suppliers-repository';
import { createSupplierEvidence } from '@/lib/supabase/supplier-evidence-repository';
import { runSupplierEvaluation } from '@/lib/supabase/supplier-evaluations-repository';
import { validateCreateSupplierInput, type CreateSupplierInput } from '@/lib/domain/supplier';
import { validateCreateSupplierEvidenceInput, type CreateSupplierEvidenceInput } from '@/lib/domain/supplier-evidence';
import { isUuid, type CorrelationId, type EvaluationId, type TenantId } from '@/lib/domain/ids';
import { validateSupplierFinalDecision, validateSupplierDecisionRationale } from '@/lib/domain/supplier-final-decision';
import { recordSupplierFinalDecision } from '@/lib/supabase/supplier-final-decisions-repository';

// Server Actions for the real supplier evaluation slice
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md). Same
// posture as apps/web/app/auth-actions.ts: every write goes through the
// caller's own cookie-backed, RLS-respecting client
// (createServerSupabaseClient) — never a service-role client. A `tenantId`
// hidden form field is never authorization by itself: resolveAuthorizedTenantContext
// re-proves it against the caller's own real active memberships and the
// required capability on every call (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md).
//
// Security correction (post-review, 2026-09-15): every write below is now
// a thin call to a security-definer, capability-checked, audited RPC
// (public.create_supplier, public.create_supplier_evidence,
// public.run_supplier_evaluation — supabase/migrations/20260914120100_suppliers.sql,
// 20260914120200_supplier_evaluation.sql). This file no longer computes,
// derives, or forwards a risk score, recommendation, or normalized input
// of any kind: the database is the sole source of truth for a supplier
// evaluation's result, so there is nothing left here for a forged Server
// Action call (or a compromised browser) to influence beyond which
// supplier/evidence is created and which supplier is evaluated — both
// already re-checked server-side against real persisted records and the
// caller's real tenant membership and capability.

export type SupplierActionResult = { status: 'success' } | { status: 'error'; code: string };

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

// Platform administrators receive no operational bypass through the real
// workspace (docs/architecture/PLATFORM-ARCHITECTURE.md; docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
// acceptance criterion 9: "No platform administrator ... produces a
// successful result"). This must be an unconditional, explicit check here
// — not an incidental consequence of platform admins usually holding no
// tenant membership in seed/fixture data. A platform admin who also
// happens to hold a real tenant membership must still never succeed at
// creating a supplier, registering evidence, or running an evaluation
// through this flow, exactly as /workspace/suppliers/page.tsx and
// /workspace/suppliers/[supplierId]/page.tsx already gate on the read
// side, and as every RPC this file calls also independently enforces at
// the database layer with no platform-admin bypass of its own
// (app.has_tenant_capability_as_member(), 20260914120050_no_bypass_authorization_helpers.sql).
const PLATFORM_ADMIN_FORBIDDEN: SupplierActionResult = { status: 'error', code: 'ForbiddenError' };

export async function createSupplierAction(
  _previousState: SupplierActionResult | null,
  formData: FormData,
): Promise<SupplierActionResult> {
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) return PLATFORM_ADMIN_FORBIDDEN;
  const client = await createServerSupabaseClient();

  const requestedTenantId = readFormValue(formData, 'tenantId') as TenantId;
  let tenantId: TenantId;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'supplier.manage');
    tenantId = context.tenantId;
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  const rawExposure = readFormValue(formData, 'annualExposureMinor');
  const input: CreateSupplierInput = {
    reference: readFormValue(formData, 'reference'),
    displayName: readFormValue(formData, 'displayName'),
    registrationCountryCode: readFormValue(formData, 'registrationCountryCode'),
    registrationIdentifier: readFormValue(formData, 'registrationIdentifier'),
    industryCode: readFormValue(formData, 'industryCode'),
    operatingCountryCodes: readFormValue(formData, 'operatingCountryCodes')
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code.length > 0),
    relationshipPurpose: readFormValue(formData, 'relationshipPurpose'),
    annualExposureMinor: Number(rawExposure),
    annualExposureCurrency: readFormValue(formData, 'annualExposureCurrency'),
    onboardingChannel: readFormValue(formData, 'onboardingChannel') as CreateSupplierInput['onboardingChannel'],
    websiteDomain: readFormValue(formData, 'websiteDomain') || null,
  };

  let supplierId: string;
  try {
    const validated = validateCreateSupplierInput(input);
    const supplier = await createSupplier(client, tenantId, validated);
    supplierId = supplier.id;
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  redirect(`/workspace/suppliers/${supplierId}?tenant=${tenantId}`);
}

export async function createEvidenceAction(
  _previousState: SupplierActionResult | null,
  formData: FormData,
): Promise<SupplierActionResult> {
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) return PLATFORM_ADMIN_FORBIDDEN;
  const client = await createServerSupabaseClient();

  const requestedTenantId = readFormValue(formData, 'tenantId') as TenantId;
  const supplierId = readFormValue(formData, 'supplierId');

  let tenantId: TenantId;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'supplier.manage');
    tenantId = context.tenantId;
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  if (!isUuid(supplierId)) {
    return { status: 'error', code: 'SupplierNotFoundError' };
  }

  try {
    // Read-only lookup, still governed by suppliers_select RLS: only used
    // here to build the evidence digest from the supplier's own reference.
    // Authorization for the write itself is enforced entirely inside
    // public.create_supplier_evidence().
    const supplier = await getSupplierById(client, tenantId, supplierId);
    if (!supplier) {
      return { status: 'error', code: 'SupplierNotFoundError' };
    }

    const input: CreateSupplierEvidenceInput = {
      evidenceType: readFormValue(formData, 'evidenceType') as CreateSupplierEvidenceInput['evidenceType'],
      displayName: readFormValue(formData, 'displayName'),
      issuerCountryCode: readFormValue(formData, 'issuerCountryCode') || null,
      issueDate: readFormValue(formData, 'issueDate') || null,
      verificationState: readFormValue(formData, 'verificationState') as CreateSupplierEvidenceInput['verificationState'],
    };
    const validated = validateCreateSupplierEvidenceInput(supplier.reference, input);
    await createSupplierEvidence(client, tenantId, supplierId, validated);
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  redirect(`/workspace/suppliers/${supplierId}?tenant=${tenantId}`);
}

export async function runEvaluationAction(
  _previousState: SupplierActionResult | null,
  formData: FormData,
): Promise<SupplierActionResult> {
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) return PLATFORM_ADMIN_FORBIDDEN;
  const client = await createServerSupabaseClient();

  const requestedTenantId = readFormValue(formData, 'tenantId') as TenantId;
  const supplierId = readFormValue(formData, 'supplierId');
  const correlationId = readFormValue(formData, 'correlationId') as CorrelationId;

  let tenantId: TenantId;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'evaluation.run');
    tenantId = context.tenantId;
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  if (!isUuid(supplierId)) {
    return { status: 'error', code: 'SupplierNotFoundError' };
  }

  try {
    // The browser never submits a factor score, recommendation, actor,
    // policy version, or result field, and neither does this function:
    // public.run_supplier_evaluation() derives everything itself from
    // persisted supplier/evidence rows and the tenant's own current
    // published policy. This action only supplies identifying references.
    await runSupplierEvaluation(client, { tenantId, supplierId, correlationId });
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  redirect(`/workspace/suppliers/${supplierId}?tenant=${tenantId}`);
}

export async function recordSupplierFinalDecisionAction(
  _previousState: SupplierActionResult | null,
  formData: FormData,
): Promise<SupplierActionResult> {
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) return PLATFORM_ADMIN_FORBIDDEN;
  const client = await createServerSupabaseClient();
  const requestedTenantId = readFormValue(formData, 'tenantId') as TenantId;
  const supplierId = readFormValue(formData, 'supplierId');
  const evaluationId = readFormValue(formData, 'evaluationId');
  const correlationId = readFormValue(formData, 'correlationId');

  let tenantId: TenantId;
  try {
    // Company Admin is a role boundary, not a generic capability. The DB RPC
    // independently enforces active tenant_admin membership.
    tenantId = (await resolveActiveTenantContext(client, identity, requestedTenantId)).tenantId;
    if (!isUuid(supplierId) || !isUuid(evaluationId) || !isUuid(correlationId)) {
      return { status: 'error', code: 'CompletedSupplierEvaluationNotFoundError' };
    }
    await recordSupplierFinalDecision(client, {
      tenantId,
      evaluationId: evaluationId as EvaluationId,
      decision: validateSupplierFinalDecision(readFormValue(formData, 'decision')),
      rationale: validateSupplierDecisionRationale(readFormValue(formData, 'rationale')),
      correlationId: correlationId as CorrelationId,
    });
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  redirect(`/workspace/suppliers/${supplierId}?tenant=${tenantId}`);
}
