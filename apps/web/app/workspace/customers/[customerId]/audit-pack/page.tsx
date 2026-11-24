import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AuditPackToolbar } from '@/components/workspace/audit-pack-toolbar';
import { buildAuditPack, canonicalJson } from '@/lib/domain/audit-pack';
import { isUuid, type CustomerId, type TenantId } from '@/lib/domain/ids';
import { bandLabel, ddLevelLabel, outcomeLabel, requiredActionLabel } from '@/lib/i18n/customer-assessment';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDate, formatDateTime } from '@/lib/i18n/presentation';
import { listActionCompletions, listCustomerAuditEvents, recordAuditPackGenerated } from '@/lib/supabase/action-completions-repository';
import { listCustomerAssessments } from '@/lib/supabase/customer-assessments-repository';
import { listCustomerDecisions } from '@/lib/supabase/customer-decisions-repository';
import { getCustomerById } from '@/lib/supabase/customers-repository';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { hasCapability } from '@/lib/supabase/authorization';
import { listCustomerTransactionChecks } from '@/lib/supabase/transaction-checks-repository';

const t = messages.auditPack;
const L = t.labels;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 break-inside-avoid-page">
      <h2 className="border-b border-border pb-1 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

const list = (codes: string[], label: (code: string) => string = (c) => c) => (codes.length > 0 ? codes.map(label).join('; ') : '—');

export default async function AuditPackPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  if (!hasPublicSupabaseConfig()) redirect('/workspace');
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
    tenantName = context.memberships.find((m) => m.tenantId === context.tenantId)?.tenantName ?? null;
  } catch {
    redirect('/workspace');
  }
  // The pack exposes the audit trail: it also needs audit.view (auditor,
  // analyst, MLRO). Without it, back to the customer page.
  const canViewAudit = await hasCapability(client, tenantId, 'audit.view').catch(() => false);
  if (!canViewAudit) redirect(`/workspace/customers/${customerId}?tenant=${tenantId}`);

  const customer = isUuid(customerId) ? await getCustomerById(client, tenantId, customerId as CustomerId) : null;
  if (!customer) redirect(`/workspace/customers?tenant=${tenantId}`);

  const [assessments, decisions, checks, completions, trail] = await Promise.all([
    listCustomerAssessments(client, tenantId, customer.id),
    listCustomerDecisions(client, tenantId, customer.id),
    listCustomerTransactionChecks(client, tenantId, customer.id),
    listActionCompletions(client, tenantId, customer.id),
    listCustomerAuditEvents(client, tenantId, customer.id),
  ]);

  const generatedAt = new Date().toISOString();
  const pack = buildAuditPack({
    generatedAt,
    generatedBy: identity.userId,
    tenant: { id: tenantId, name: tenantName },
    customer: {
      id: customer.id,
      external_reference: customer.externalReference,
      full_name: customer.fullName,
      date_of_birth: customer.dateOfBirth,
      country_of_birth: customer.countryOfBirth,
      nationality: customer.nationality,
      residence_country: customer.residenceCountry,
      onboarding_channel: customer.onboardingChannel,
      status: customer.status,
      created_at: customer.createdAt,
      created_by: customer.createdBy,
    },
    assessments: assessments.map((a) => ({
      id: a.id,
      assessed_at: a.assessedAt,
      assessed_by: a.assessedBy,
      policy_version_id: a.policyVersionId,
      overall_score: a.overallScore,
      band: a.band,
      dd_level: a.ddLevel,
      outcome: a.outcome,
      next_review_due: a.nextReviewDue,
      facts: a.facts,
      result: a.result,
      input_hash: a.inputHash,
      correlation_id: a.correlationId,
    })),
    decisions: decisions.map((d) => ({
      id: d.id,
      assessment_id: d.assessmentId,
      level: d.level,
      decision: d.decision,
      rationale: d.rationale,
      decided_by: d.decidedBy,
      decided_at: d.decidedAt,
    })),
    transactionChecks: checks.map((c) => ({
      id: c.id,
      checked_at: c.checkedAt,
      checked_by: c.checkedBy,
      ruleset_version: c.rulesetVersion,
      inputs: c.inputs,
      results: c.results,
      hits: c.hits,
    })),
    actionCompletions: completions.map((c) => ({
      id: c.id,
      source_type: c.sourceType,
      source_id: c.sourceId,
      action_code: c.actionCode,
      evidence_note: c.evidenceNote,
      completed_by: c.completedBy,
      completed_at: c.completedAt,
    })),
    auditTrail: trail.map((e) => ({
      id: e.id,
      occurred_at: e.occurredAt,
      actor_id: e.actorId,
      action: e.action,
      target_type: e.targetType,
      target_id: e.targetId,
      metadata: e.metadata,
    })),
  });
  const json = canonicalJson(pack);
  const sha256 = createHash('sha256').update(json).digest('hex');
  await recordAuditPackGenerated(client, { tenantId, customerId: customer.id, sha256 });

  const { data: userData } = await client.auth.getUser();
  const who = userData.user?.email ?? identity.userId;
  const trigger = messages.transactionTriggers;
  const decisionLabels = messages.customerDecision;

  return (
    <main className="mx-auto max-w-4xl space-y-6 bg-white px-6 py-8 text-foreground print:max-w-none print:px-0 print:py-0">
      <AuditPackToolbar
        json={json}
        fileName={`mitiga-audit-pack-${customer.externalReference}-${generatedAt.slice(0, 10)}.json`}
        backHref={`/workspace/customers/${customer.id}?tenant=${tenantId}`}
      />

      <header className="space-y-1 border-b-2 border-foreground pb-3">
        <p className="text-xs font-semibold tracking-[0.12em] uppercase">MITIGA · {t.title}</p>
        <h1 className="text-2xl font-semibold">{customer.fullName} · {customer.externalReference}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="text-xs">{interpolate(t.generatedLine, { date: formatDateTime(generatedAt), who, tenant: tenantName ?? tenantId })}</p>
        <p className="font-mono text-[0.7rem] break-all">{interpolate(t.integrity, { hash: sha256 })}</p>
        <p className="text-xs text-muted-foreground">{t.integrityHint}</p>
      </header>

      <Section title={t.sections.customer}>
        <dl className="space-y-1">
          <Field label="Full name" value={customer.fullName} />
          <Field label="External reference" value={customer.externalReference} />
          <Field label="Date of birth" value={formatDate(customer.dateOfBirth)} />
          <Field label="Country of birth / nationality / residence" value={`${customer.countryOfBirth} / ${customer.nationality} / ${customer.residenceCountry}`} />
          <Field label="Onboarding channel" value={customer.onboardingChannel} />
          <Field label="Recorded" value={formatDateTime(customer.createdAt)} />
        </dl>
      </Section>

      <Section title={`${t.sections.assessments} (${assessments.length})`}>
        {assessments.length === 0 ? <p className="text-sm">{t.none}</p> : null}
        {pack.assessments.map((a) => {
          const result = a.result as (typeof assessments)[number]['result'];
          return (
            <div key={String(a.id)} className="space-y-1 rounded border border-border p-3 break-inside-avoid">
              <p className="text-sm font-semibold">{formatDateTime(String(a.assessed_at))}</p>
              <dl className="space-y-1">
                <Field label={L.score} value={String(a.overall_score)} />
                <Field label={L.band} value={bandLabel(result.band)} />
                <Field label={L.dd} value={ddLevelLabel(result.dd_level)} />
                <Field label={L.outcome} value={outcomeLabel(result.outcome)} />
                <Field label={L.overrides} value={list(result.overrides_hit)} />
                <Field label={L.reasons} value={list(result.reason_codes)} />
                <Field label={L.actions} value={list(result.required_actions, requiredActionLabel)} />
                <Field label={L.missing} value={list(result.missing_factors)} />
                <Field label={L.review} value={formatDate(String(a.next_review_due))} />
                <Field label={L.policy} value={<span className="font-mono text-xs">{String(a.policy_version_id)}</span>} />
                <Field label={L.inputs} value={<span className="font-mono text-xs">{JSON.stringify(a.facts)}</span>} />
              </dl>
            </div>
          );
        })}
      </Section>

      <Section title={`${t.sections.decisions} (${decisions.length})`}>
        {decisions.length === 0 ? <p className="text-sm">{t.none}</p> : null}
        {decisions.map((d) => (
          <dl key={d.id} className="space-y-1 rounded border border-border p-3 break-inside-avoid">
            <Field label={L.at} value={formatDateTime(d.decidedAt)} />
            <Field label={L.level} value={decisionLabels.levels[d.level]} />
            <Field label={L.decision} value={decisionLabels.decisions[d.decision]} />
            <Field label={L.rationale} value={d.rationale} />
            <Field label={L.by} value={<span className="font-mono text-xs">{d.decidedBy}</span>} />
          </dl>
        ))}
      </Section>

      <Section title={`${t.sections.checks} (${checks.length})`}>
        {checks.length === 0 ? <p className="text-sm">{t.none}</p> : null}
        {[...checks].reverse().map((c) => (
          <div key={c.id} className="space-y-1 rounded border border-border p-3 break-inside-avoid">
            <p className="text-sm font-semibold">{formatDateTime(c.checkedAt)} · {L.ruleset} {c.rulesetVersion}</p>
            <ul className="space-y-0.5 text-sm">
              {c.results.map((r) => (
                <li key={r.code}>
                  {(trigger.rules as Record<string, string>)[r.code] ?? r.code}: <strong>{(trigger.statuses as Record<string, string>)[r.status] ?? r.status}</strong>
                  {r.metric !== null ? ` (${r.metric} vs ${r.threshold ?? '—'})` : ''}
                </li>
              ))}
            </ul>
            <Field label={L.inputs} value={<span className="font-mono text-xs">{JSON.stringify(c.inputs)}</span>} />
          </div>
        ))}
      </Section>

      <Section title={`${t.sections.completions} (${completions.length})`}>
        {completions.length === 0 ? <p className="text-sm">{t.none}</p> : null}
        {completions.map((c) => (
          <dl key={c.id} className="space-y-1 rounded border border-border p-3 break-inside-avoid">
            <Field label={L.at} value={formatDateTime(c.completedAt)} />
            <Field label={L.actions} value={c.sourceType === 'assessment' ? requiredActionLabel(c.actionCode) : ((trigger.actions as Record<string, string>)[c.actionCode] ?? c.actionCode)} />
            <Field label={L.source} value={c.sourceType} />
            <Field label={L.note} value={c.evidenceNote} />
          </dl>
        ))}
      </Section>

      <Section title={`${t.sections.trail} (${trail.length})`}>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-2 font-medium">{L.at}</th>
              <th className="py-1 pr-2 font-medium">{L.event}</th>
              <th className="py-1 font-medium">{L.by}</th>
            </tr>
          </thead>
          <tbody>
            {trail.map((e) => (
              <tr key={e.id} className="border-b border-border/60 align-top">
                <td className="py-1 pr-2 whitespace-nowrap">{formatDateTime(e.occurredAt)}</td>
                <td className="py-1 pr-2">{e.action}</td>
                <td className="py-1 font-mono">{e.actorId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </main>
  );
}
