'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { createSupplier, getSupplierById } from '@/lib/supabase/suppliers-repository';
import { createSupplierEvidence, listSupplierEvidence } from '@/lib/supabase/supplier-evidence-repository';
import { getCurrentPublishedPolicy } from '@/lib/supabase/published-policy-repository';
import { completeSupplierEvaluation } from '@/lib/supabase/supplier-evaluations-repository';
import { validateCreateSupplierInput, type CreateSupplierInput } from '@/lib/domain/supplier';
import { validateCreateSupplierEvidenceInput, type CreateSupplierEvidenceInput } from '@/lib/domain/supplier-evidence';
import { deriveSupplierEvaluationFacts, computeSupplierEvaluationInputHash } from '@/lib/domain/supplier-evaluation-adapter';
import { runEvaluation, EVALUATION_ENGINE_CONTRACT_VERSION } from '@/lib/domain/evaluation-engine';
import { isUuid, type CorrelationId, type TenantId } from '@/lib/domain/ids';

// Server Actions for the real supplier evaluation slice
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md). Same
// posture as apps/web/app/auth-actions.ts: every write goes through the
// caller's own cookie-backed, RLS-respecting client
// (createServerSupabaseClient) — never a service-role client. A `tenantId`
// hidden form field is never authorization by itself: resolveAuthorizedTenantContext
// re-proves it against the caller's own real active memberships and the
// required capability on every call (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md).
// The pure evaluation engine (apps/web/lib/domain/evaluation-engine.ts) is
// never modified or bypassed: this file only derives its input from
// persisted records and persists its output, atomically, through
// public.complete_supplier_evaluation().

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
// /workspace/suppliers/[supplierId]/page.tsx already gate on the read side.
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
    const supplier = await createSupplier(client, tenantId, identity.userId, validated);
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
    await createSupplierEvidence(client, tenantId, supplierId, identity.userId, validated);
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
    // policy version, or result field: every input to the engine below is
    // re-read here from records this request just fetched under RLS.
    const supplier = await getSupplierById(client, tenantId, supplierId);
    if (!supplier) {
      return { status: 'error', code: 'SupplierNotFoundError' };
    }
    const evidence = await listSupplierEvidence(client, tenantId, supplierId);
    const policy = await getCurrentPublishedPolicy(client, tenantId);

    const facts = deriveSupplierEvaluationFacts(supplier, evidence);
    const inputHash = computeSupplierEvaluationInputHash({
      policyVersionId: policy.policyVersionId,
      supplierId,
      facts,
    });

    const engineResult = runEvaluation({
      contractVersion: EVALUATION_ENGINE_CONTRACT_VERSION,
      policyVersionId: policy.policyVersionId,
      correlationId,
      factors: policy.factors,
      thresholds: policy.thresholds,
      facts,
    });

    await completeSupplierEvaluation(client, {
      tenantId,
      supplierId,
      policyVersionId: policy.policyVersionId,
      correlationId,
      inputHash,
      normalizedInput: facts,
      score: engineResult.score,
      decisionBand: engineResult.recommendation,
      dataQuality: engineResult.dataQuality,
      missingRequiredFactorKeys: engineResult.missingRequiredFactorKeys,
      reasons: engineResult.reasons,
    });
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  redirect(`/workspace/suppliers/${supplierId}?tenant=${tenantId}`);
}
