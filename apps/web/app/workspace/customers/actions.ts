'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { createCustomer } from '@/lib/supabase/customers-repository';
import {
  getCustomerAssessmentForm,
  runCustomerAssessment,
} from '@/lib/supabase/customer-assessments-repository';
import { validateCreateCustomerInput, type CreateCustomerInput } from '@/lib/domain/customer';
import { buildAssessmentFacts } from '@/lib/domain/customer-assessment-facts';
import { isUuid, type CorrelationId, type CustomerId, type TenantId } from '@/lib/domain/ids';

// Server Actions for the customer CRA experience
// (docs/tasks/TASK-035-cursor-customer-assessment-experience.md). Same
// posture as app/workspace/suppliers/actions.ts: every write goes through
// the caller's own cookie-backed, RLS-respecting client
// (createServerSupabaseClient), never a service-role client. The `tenantId`
// hidden field is only a candidate: resolveAuthorizedTenantContext re-proves
// it against the caller's real active memberships and the required
// capability on every call. Each write is a thin call to a security-definer,
// capability-checked, audited RPC (public.create_customer,
// public.run_customer_assessment —
// supabase/migrations/20260927100000_customer_assessment.sql and later
// redefinitions). An assessment forwards only facts and the correlation id
// generated at render; the database alone computes and persists the score,
// band, DD level and outcome.

export type CustomerActionResult =
  | { status: 'success' }
  | { status: 'error'; code: string; correlationId?: string };

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

// Platform administrators receive no operational bypass, exactly as in
// app/workspace/suppliers/actions.ts; the RPCs also deny them independently
// (app.has_tenant_capability_as_member()).
const PLATFORM_ADMIN_FORBIDDEN: CustomerActionResult = { status: 'error', code: 'ForbiddenError' };

export async function createCustomerAction(
  _previousState: CustomerActionResult | null,
  formData: FormData,
): Promise<CustomerActionResult> {
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) return PLATFORM_ADMIN_FORBIDDEN;
  const client = await createServerSupabaseClient();

  const requestedTenantId = readFormValue(formData, 'tenantId') as TenantId;
  let tenantId: TenantId;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'customer.manage');
    tenantId = context.tenantId;
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  const input: CreateCustomerInput = {
    externalReference: readFormValue(formData, 'externalReference'),
    fullName: readFormValue(formData, 'fullName'),
    dateOfBirth: readFormValue(formData, 'dateOfBirth'),
    countryOfBirth: readFormValue(formData, 'countryOfBirth'),
    nationality: readFormValue(formData, 'nationality'),
    residenceCountry: readFormValue(formData, 'residenceCountry'),
    onboardingChannel: readFormValue(formData, 'onboardingChannel') as CreateCustomerInput['onboardingChannel'],
  };

  let customerId: string;
  try {
    const validated = validateCreateCustomerInput(input);
    const customer = await createCustomer(client, tenantId, validated);
    customerId = customer.id;
  } catch (error) {
    return { status: 'error', code: errorCode(error) };
  }

  redirect(`/workspace/customers/${customerId}?tenant=${tenantId}`);
}

class AssessmentPolicyChangedError extends Error {
  constructor() {
    super('The published policy changed after the form was rendered');
    this.name = 'AssessmentPolicyChangedError';
  }
}

export async function runCustomerAssessmentAction(
  _previousState: CustomerActionResult | null,
  formData: FormData,
): Promise<CustomerActionResult> {
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) return PLATFORM_ADMIN_FORBIDDEN;
  const client = await createServerSupabaseClient();

  const requestedTenantId = readFormValue(formData, 'tenantId') as TenantId;
  const customerId = readFormValue(formData, 'customerId');
  const correlationId = readFormValue(formData, 'correlationId');

  let tenantId: TenantId;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'assessment.run');
    tenantId = context.tenantId;
  } catch (error) {
    if (errorCode(error) === 'ForbiddenError') redirect('/denied');
    return { status: 'error', code: errorCode(error) };
  }

  if (!isUuid(customerId) || !isUuid(correlationId)) {
    return { status: 'error', code: 'InvalidAssessmentRequestError' };
  }

  let denied = false;
  try {
    // The form is re-read server-side: only the keys and values it lists can
    // become facts, whatever the browser submitted.
    const form = await getCustomerAssessmentForm(client, tenantId);
    if (readFormValue(formData, 'policyVersionId') !== form.policyVersionId) {
      throw new AssessmentPolicyChangedError();
    }
    const facts = buildAssessmentFacts(form, (name) => {
      const value = formData.get(name);
      return typeof value === 'string' ? value : null;
    });
    await runCustomerAssessment(client, {
      tenantId,
      customerId: customerId as CustomerId,
      facts,
      correlationId: correlationId as CorrelationId,
    });
  } catch (error) {
    if (errorCode(error) === 'ForbiddenError') {
      denied = true;
    } else {
      return { status: 'error', code: errorCode(error), correlationId };
    }
  }
  if (denied) redirect('/denied');

  redirect(`/workspace/customers/${customerId}?tenant=${tenantId}`);
}
