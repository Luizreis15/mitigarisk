import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { hasCapability } from '@/lib/supabase/authorization';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { getCustomerById } from '@/lib/supabase/customers-repository';
import {
  getCustomerAssessmentForm,
  listCustomerAssessments,
} from '@/lib/supabase/customer-assessments-repository';
import { isUuid, type CustomerId, type TenantId } from '@/lib/domain/ids';
import { CustomerProfile } from '@/components/workspace/customer-profile';
import { CustomerAssessmentResult } from '@/components/workspace/customer-assessment-result';
import { CustomerAssessmentHistory } from '@/components/workspace/customer-assessment-history';
import { CustomerAssessmentForm } from '@/components/workspace/customer-assessment-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CustomerAssessmentForm as AssessmentFormData } from '@/lib/domain/customer-assessment';
import { WorkspaceRealFrame } from '@/components/workspace/workspace-real-frame';
import { buildAssessmentResultView } from '@/lib/i18n/customer-assessment';
import { buildAssessmentFormView } from '@/lib/i18n/customer-assessment-form';
import { messages } from '@/lib/i18n/messages';

// Customer profile, latest persisted assessment, and history
// (docs/tasks/TASK-035-cursor-customer-assessment-experience.md). Every read
// goes through the caller's own RLS-scoped client and the tenant re-validated
// on this request; a malformed or cross-tenant id renders the same generic
// "not found" state.
export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  if (!hasPublicSupabaseConfig()) {
    redirect('/workspace');
  }

  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) {
    redirect('/workspace');
  }

  const client = await createServerSupabaseClient();
  const { customerId } = await params;
  const rawTenant = (await searchParams).tenant;
  const requestedTenantId = rawTenant ? (rawTenant as TenantId) : null;

  let tenantId: TenantId;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'customer.view');
    tenantId = context.tenantId;
  } catch {
    redirect('/workspace');
  }

  const t = messages.customerWorkspace;
  const listHref = `/workspace/customers?tenant=${tenantId}`;
  const customer = isUuid(customerId)
    ? await getCustomerById(client, tenantId, customerId as CustomerId)
    : null;
  if (!customer) {
    return (
      <WorkspaceRealFrame
        title={t.missingTitle}
        intro={t.missingBody}
        kicker={t.kicker}
        fictionalNotice={t.fictionalNotice}
        backHref={listHref}
        backLabel={t.backToCustomers}
      >
        <></>
      </WorkspaceRealFrame>
    );
  }

  const [assessments, canRunAssessment] = await Promise.all([
    listCustomerAssessments(client, tenantId, customer.id),
    hasCapability(client, tenantId, 'assessment.run'),
  ]);
  const latest = assessments[0] ?? null;

  // Read only for callers holding assessment.run (the RPC requires it too),
  // so an auditor never receives the form or any assessment control.
  let form: AssessmentFormData | null = null;
  let formUnavailable: 'no_policy' | 'error' | null = null;
  if (canRunAssessment) {
    try {
      form = await getCustomerAssessmentForm(client, tenantId);
    } catch (error) {
      formUnavailable =
        error instanceof Error && error.name === 'NoPublishedCraPolicyError' ? 'no_policy' : 'error';
    }
  }
  const currentPolicy = form ? { id: form.policyVersionId, label: form.policyLabel } : null;
  // Generated on every server render and never derived from browser input:
  // a double submit of this rendered form replays idempotently, and a
  // reload allows a genuinely new assessment.
  const correlationId = randomUUID();

  return (
    <WorkspaceRealFrame
      title={customer.fullName}
      intro={t.detailIntro}
      kicker={t.kicker}
      fictionalNotice={t.fictionalNotice}
      backHref={listHref}
      backLabel={t.backToCustomers}
    >
      <CustomerProfile customer={customer} />
      <section
        aria-labelledby="customer-latest-assessment"
        className="space-y-5 rounded-xl border border-border p-5 sm:p-6"
      >
        <h2 id="customer-latest-assessment" className="text-base font-medium">
          {t.latestTitle}
        </h2>
        {latest ? (
          <CustomerAssessmentResult
            view={buildAssessmentResultView({
              ...latest,
              policyLabel:
                currentPolicy && latest.policyVersionId === currentPolicy.id ? currentPolicy.label : null,
            })}
          />
        ) : (
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-sm font-medium">{t.noAssessmentTitle}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t.noAssessmentBody}
            </p>
          </div>
        )}
      </section>
      {canRunAssessment && form ? (
        <CustomerAssessmentForm
          view={buildAssessmentFormView(form)}
          tenantId={tenantId}
          customerId={customer.id}
          correlationId={correlationId}
        />
      ) : null}
      {canRunAssessment && formUnavailable ? (
        <Alert variant={formUnavailable === 'no_policy' ? 'default' : 'destructive'}>
          <AlertTitle>
            {formUnavailable === 'no_policy' ? t.assessmentForm.noPolicyTitle : t.assessmentForm.unavailableTitle}
          </AlertTitle>
          <AlertDescription>
            {formUnavailable === 'no_policy' ? t.assessmentForm.noPolicyBody : t.assessmentForm.unavailableBody}
          </AlertDescription>
        </Alert>
      ) : null}
      <CustomerAssessmentHistory
        assessments={assessments}
        currentUserId={identity.userId}
        currentPolicy={currentPolicy}
      />
    </WorkspaceRealFrame>
  );
}
