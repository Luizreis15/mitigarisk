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
import { CustomerDecisionPanel } from '@/components/workspace/customer-decision-panel';
import { listCustomerDecisions } from '@/lib/supabase/customer-decisions-repository';
import { decisionStatusFor, type CustomerDecision } from '@/lib/domain/customer-decision';
import { formatDate, formatDateTime } from '@/lib/i18n/presentation';
import { DetailTabs } from '@/components/workspace/detail-tabs';
import { RecordHero, type HeroStatusTone } from '@/components/workspace/record-hero';
import { TransactionTriggerPanel } from '@/components/workspace/transaction-trigger-panel';
import { listCustomerTransactionChecks } from '@/lib/supabase/transaction-checks-repository';
import type { TransactionCheck } from '@/lib/domain/transaction-check';
import { RequiredActionsPanel, type RequiredActionItem } from '@/components/workspace/required-actions-panel';
import {
  completionKey,
  listActionCompletions,
  type ActionCompletion,
} from '@/lib/supabase/action-completions-repository';
import { requiredActionLabel } from '@/lib/i18n/customer-assessment';
import { interpolate } from '@/lib/i18n/messages';
import { FileTextIcon } from 'lucide-react';

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
  let tenantName: string | null = null;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'customer.view');
    tenantId = context.tenantId;
    tenantName =
      context.memberships.find((m) => m.tenantId === context.tenantId)?.tenantName ?? null;
  } catch {
    redirect('/workspace');
  }

  const { data: userData } = await client.auth.getUser();
  const signedInEmail = userData.user?.email ?? null;
  const t = messages.customerWorkspace;
  const listHref = `/workspace/customers?tenant=${tenantId}`;
  const shell = {
    tenantId,
    tenantName,
    signedInEmail,
  } as const;
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
        {...shell}
      >
        <></>
      </WorkspaceRealFrame>
    );
  }

  const [assessments, canRunAssessment, canDecide, decisions] = await Promise.all([
    listCustomerAssessments(client, tenantId, customer.id),
    hasCapability(client, tenantId, 'assessment.run'),
    hasCapability(client, tenantId, 'case.decide').catch(() => false),
    listCustomerDecisions(client, tenantId, customer.id).catch((): CustomerDecision[] => []),
  ]);
  const latest = assessments[0] ?? null;
  const transactionChecks = await listCustomerTransactionChecks(client, tenantId, customer.id).catch(
    (): TransactionCheck[] => [],
  );
  const latestCheck = transactionChecks[0] ?? null;
  const [completions, canManageCustomer, canViewAudit] = await Promise.all([
    listActionCompletions(client, tenantId, customer.id).catch((): ActionCompletion[] => []),
    hasCapability(client, tenantId, 'customer.manage').catch(() => false),
    hasCapability(client, tenantId, 'audit.view').catch(() => false),
  ]);
  const completionByKey = new Map(completions.map((c) => [completionKey(c.sourceType, c.sourceId, c.actionCode), c]));
  const who = (userId: string) =>
    userId === identity.userId ? messages.customerDecision.byYou : messages.customerDecision.byMember;
  const requiredItems: RequiredActionItem[] = [
    ...(latest
      ? latest.result.required_actions.map((code) => ({
          sourceType: 'assessment' as const,
          sourceId: latest.id,
          sourceLabel: interpolate(messages.requiredActions.fromAssessment, { date: formatDateTime(latest.assessedAt) }),
          actionCode: code,
          label: requiredActionLabel(code),
        }))
      : []),
    ...(latestCheck
      ? latestCheck.actions.map((code) => ({
          sourceType: 'transaction_check' as const,
          sourceId: latestCheck.id,
          sourceLabel: interpolate(messages.requiredActions.fromCheck, { date: formatDateTime(latestCheck.checkedAt) }),
          actionCode: code,
          label: (messages.transactionTriggers.actions as Record<string, string>)[code] ?? code,
        }))
      : []),
  ].map((item) => {
    const key = completionKey(item.sourceType, item.sourceId, item.actionCode);
    const done = completionByKey.get(key);
    return {
      ...item,
      key,
      completion: done ? { who: who(done.completedBy), date: formatDateTime(done.completedAt), note: done.evidenceNote } : null,
    };
  });
  const completionCorrelationIds = Object.fromEntries(requiredItems.map((item) => [item.key, randomUUID()]));
  const decisionStatus = decisionStatusFor(latest, decisions);
  const decisionTrail = [decisionStatus.mlro, decisionStatus.board]
    .filter((d): d is CustomerDecision => d !== null)
    .map((d) => ({
      id: d.id,
      level: d.level,
      decision: d.decision,
      rationale: d.rationale,
      who: d.decidedBy === identity.userId ? messages.customerDecision.byYou : messages.customerDecision.byMember,
      date: formatDateTime(d.decidedAt),
    }));

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

  const resultView = latest
    ? buildAssessmentResultView({
        ...latest,
        policyLabel: currentPolicy && latest.policyVersionId === currentPolicy.id ? currentPolicy.label : null,
      })
    : null;
  const hero = messages.recordHero;
  const heroStatus: { label: string; tone: HeroStatusTone } = !latest
    ? { label: hero.status.notAssessed, tone: 'neutral' }
    : latest.outcome === 'REJECT'
      ? { label: hero.status.policyReject, tone: 'bad' }
      : decisionStatus.state === 'awaiting_mlro'
        ? { label: hero.status.awaitingMlro, tone: 'wait' }
        : decisionStatus.state === 'awaiting_board'
          ? { label: hero.status.awaitingBoard, tone: 'wait' }
          : decisionStatus.state === 'approved'
            ? { label: hero.status.approved, tone: 'good' }
            : decisionStatus.state === 'rejected'
              ? { label: hero.status.rejected, tone: 'bad' }
              : { label: hero.status.cleared, tone: 'good' };
  const openActions = requiredItems.filter((item) => !item.completion).length;

  return (
    <WorkspaceRealFrame
      title={customer.fullName}
      intro=""
      kicker={t.kicker}
      fictionalNotice={t.fictionalNotice}
      backHref={listHref}
      backLabel={t.backToCustomers}
      {...shell}
    >
      <RecordHero
        reference={customer.externalReference}
        meta={`${formatDate(customer.dateOfBirth)} · ${customer.nationality} / ${customer.residenceCountry}`}
        risk={
          latest && resultView
            ? {
                score: latest.overallScore,
                band: latest.band,
                ddLabel: resultView.ddLevelLabel,
                overrideLabels: resultView.overrides.map((o) => o.label),
              }
            : null
        }
        status={heroStatus}
        actions={
          <>
            {canViewAudit ? (
              <a
                href={`/workspace/customers/${customer.id}/audit-pack?tenant=${tenantId}`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FileTextIcon aria-hidden="true" className="size-4" />
                {messages.auditPack.open}
              </a>
            ) : null}
            {canRunAssessment && form ? (
              <a
                href="#run-customer-assessment"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t.runAssessmentJump}
              </a>
            ) : null}
          </>
        }
      />

      <DetailTabs
        label={hero.tabs.label}
        tabs={[
          {
            id: 'overview',
            label: hero.tabs.overview,
            count: openActions,
            anchors: ['customer-decision', 'required-actions', 'customer-latest-assessment'],
            content: (
              <>
                {latest && decisionStatus.state !== 'not_required' ? (
                  <CustomerDecisionPanel
                    state={decisionStatus.state}
                    pendingLevel={decisionStatus.pendingLevel}
                    trail={decisionTrail}
                    canDecide={canDecide}
                    tenantId={tenantId}
                    customerId={customer.id}
                    assessmentId={latest.id}
                    correlationId={randomUUID()}
                  />
                ) : null}
                <RequiredActionsPanel
                  items={requiredItems}
                  canComplete={canManageCustomer}
                  tenantId={tenantId}
                  customerId={customer.id}
                  correlationIds={completionCorrelationIds}
                />
                <section id="customer-latest-assessment" aria-label={t.latestTitle} className="scroll-mt-28">
                  {resultView ? (
                    <CustomerAssessmentResult view={resultView} />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-card px-5 py-6">
                      <p className="text-sm font-medium">{t.noAssessmentTitle}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.noAssessmentBody}</p>
                    </div>
                  )}
                </section>
              </>
            ),
          },
          {
            id: 'assessment',
            label: hero.tabs.assessment,
            anchors: ['run-customer-assessment'],
            content: (
              <>
                {canRunAssessment && form ? (
                  <div id="run-customer-assessment" className="scroll-mt-28">
                    <CustomerAssessmentForm
                      view={buildAssessmentFormView(form)}
                      tenantId={tenantId}
                      customerId={customer.id}
                      correlationId={correlationId}
                    />
                  </div>
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
                <CustomerAssessmentHistory assessments={assessments} currentUserId={identity.userId} currentPolicy={currentPolicy} />
              </>
            ),
          },
          {
            id: 'transactions',
            label: hero.tabs.transactions,
            count: latestCheck ? latestCheck.hitCount : 0,
            anchors: ['transaction-triggers'],
            content: (
              <TransactionTriggerPanel
                latest={latestCheck}
                latestWho={
                  latestCheck && latestCheck.checkedBy === identity.userId
                    ? messages.customerDecision.byYou
                    : messages.customerDecision.byMember
                }
                latestDate={latestCheck ? formatDateTime(latestCheck.checkedAt) : ''}
                history={transactionChecks.map((check) => ({
                  id: check.id,
                  date: formatDateTime(check.checkedAt),
                  hitCount: check.hitCount,
                }))}
                canRun={canRunAssessment}
                tenantId={tenantId}
                customerId={customer.id}
                correlationId={randomUUID()}
              />
            ),
          },
          { id: 'profile', label: hero.tabs.profile, content: <CustomerProfile customer={customer} /> },
        ]}
      />
    </WorkspaceRealFrame>
  );
}
