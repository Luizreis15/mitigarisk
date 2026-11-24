import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';

import { PortfolioReportToolbar } from '@/components/workspace/portfolio-report-toolbar';
import { canonicalJson } from '@/lib/domain/audit-pack';
import type { TenantId } from '@/lib/domain/ids';
import {
  buildPortfolioReport,
  portfolioReportCsv,
  type PortfolioReportRow,
  type PortfolioReportSummary,
} from '@/lib/domain/portfolio-report';
import type { TransactionCheck } from '@/lib/domain/transaction-check';
import { bandLabel, ddLevelShortLabel } from '@/lib/i18n/customer-assessment';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDate, formatDateTime } from '@/lib/i18n/presentation';
import { recordPortfolioReportGenerated } from '@/lib/supabase/action-completions-repository';
import { hasCapability } from '@/lib/supabase/authorization';
import { listLatestCustomerAssessments } from '@/lib/supabase/customer-assessments-repository';
import { listTenantCustomerDecisions } from '@/lib/supabase/customer-decisions-repository';
import { listCustomers } from '@/lib/supabase/customers-repository';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { listLatestTransactionChecks } from '@/lib/supabase/transaction-checks-repository';

const t = messages.portfolioReport;

type SummaryKey = Exclude<keyof PortfolioReportSummary, 'review_lead_days'>;

const SUMMARY_GROUPS: { title: string; keys: SummaryKey[] }[] = [
  { title: t.groups.risk, keys: ['customers', 'band_high', 'high_by_rule', 'band_medium', 'band_low', 'not_assessed'] },
  { title: t.groups.dd, keys: ['dd_enhanced', 'dd_standard', 'dd_simplified'] },
  { title: t.groups.decisions, keys: ['awaiting_decision', 'approved', 'do_not_onboard'] },
  { title: t.groups.monitoring, keys: ['reviews_overdue', 'reviews_due_soon', 'with_transaction_triggers'] },
];

function statusText(row: PortfolioReportRow): string {
  if (row.decision && row.decision !== 'not_required') return t.decisionStates[row.decision];
  return messages.workQueue.stages[row.stage].title;
}

const th = 'border-b border-foreground/40 px-2 py-1.5 text-left text-[0.7rem] font-semibold tracking-wide uppercase';
const td = 'border-b border-border px-2 py-1.5 align-top';

// Consolidated report of the company's customers, built only from stored
// records. Requires customer.view and audit.view (auditor, analyst, MLRO),
// like the per-customer audit pack; each generation is recorded in the
// audit trail with the SHA-256 of the JSON content.
export default async function PortfolioReportPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  if (!hasPublicSupabaseConfig()) redirect('/workspace');
  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) {
    redirect('/workspace');
  }

  const client = await createServerSupabaseClient();
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
  const listHref = `/workspace/customers?tenant=${tenantId}`;
  const canViewAudit = await hasCapability(client, tenantId, 'audit.view').catch(() => false);
  if (!canViewAudit) redirect(listHref);

  const [customers, latestByCustomer, decisions, latestChecks] = await Promise.all([
    listCustomers(client, tenantId),
    listLatestCustomerAssessments(client, tenantId),
    listTenantCustomerDecisions(client, tenantId),
    listLatestTransactionChecks(client, tenantId).catch(() => new Map<string, TransactionCheck>()),
  ]);

  const generatedAt = new Date().toISOString();
  const report = buildPortfolioReport({
    generatedAt,
    generatedBy: identity.userId,
    tenant: { id: tenantId, name: tenantName },
    customers,
    latestByCustomer,
    decisions,
    triggerHitsByCustomer: new Map([...latestChecks].map(([customerId, check]) => [customerId, check.hitCount])),
  });
  const json = canonicalJson(report);
  const sha256 = createHash('sha256').update(json).digest('hex');
  await recordPortfolioReportGenerated(client, { tenantId, sha256, customerCount: report.customers.length });

  const { data: userData } = await client.auth.getUser();
  const who = userData.user?.email ?? identity.userId;
  const summary = report.summary;

  return (
    <main className="mx-auto max-w-6xl space-y-6 bg-white px-6 py-8 text-foreground print:max-w-none print:px-0 print:py-0">
      <PortfolioReportToolbar
        json={json}
        csv={portfolioReportCsv(report)}
        fileBase={`mitiga-portfolio-report-${generatedAt.slice(0, 10)}`}
        backHref={listHref}
      />

      <header className="space-y-1 border-b-2 border-foreground pb-3">
        <p className="text-xs font-semibold tracking-[0.12em] uppercase">MITIGA · {t.title}</p>
        <h1 className="text-2xl font-semibold">{tenantName ?? tenantId}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="text-xs">{interpolate(t.generatedLine, { date: formatDateTime(generatedAt), who, tenant: tenantName ?? tenantId })}</p>
        <p className="font-mono text-[0.7rem] break-all">{interpolate(t.integrity, { hash: sha256 })}</p>
        <p className="text-xs text-muted-foreground">{t.integrityHint}</p>
      </header>

      <section className="space-y-3" aria-labelledby="portfolio-summary">
        <h2 id="portfolio-summary" className="border-b border-border pb-1 text-base font-semibold">{t.summaryTitle}</h2>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 print:grid-cols-2">
          {SUMMARY_GROUPS.map((group) => (
            <div key={group.title} className="break-inside-avoid">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.title}</h3>
              <dl className="mt-1">
                {group.keys.map((key) => (
                  <div key={key} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1 text-sm">
                    <dt>{interpolate(t.summary[key], { days: summary.review_lead_days })}</dt>
                    <dd className="font-mono font-semibold tabular-nums">{summary[key]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="portfolio-customers">
        <h2 id="portfolio-customers" className="border-b border-border pb-1 text-base font-semibold">
          {interpolate(t.customersTitle, { count: report.customers.length })}
        </h2>
        {report.customers.length === 0 ? (
          <p className="text-sm">{t.none}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t.orderNote}</p>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[56rem] border-collapse text-xs print:min-w-0">
                <thead>
                  <tr>
                    <th scope="col" className={th}>{t.columns.reference}</th>
                    <th scope="col" className={th}>{t.columns.name}</th>
                    <th scope="col" className={th}>{t.columns.countries}</th>
                    <th scope="col" className={`${th} text-right`}>{t.columns.score}</th>
                    <th scope="col" className={th}>{t.columns.band}</th>
                    <th scope="col" className={th}>{t.columns.dd}</th>
                    <th scope="col" className={th}>{t.columns.status}</th>
                    <th scope="col" className={th}>{t.columns.assessed}</th>
                    <th scope="col" className={th}>{t.columns.review}</th>
                    <th scope="col" className={`${th} text-right`}>{t.columns.triggers}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.customers.map((row) => (
                    <tr key={row.external_reference} className="break-inside-avoid">
                      <td className={`${td} font-mono`}>{row.external_reference}</td>
                      <td className={td}>{row.full_name}</td>
                      <td className={`${td} font-mono`}>{row.nationality} / {row.residence_country}</td>
                      <td className={`${td} text-right font-mono tabular-nums`}>{row.overall_score ?? t.noCheck}</td>
                      <td className={td}>
                        {row.band ? bandLabel(row.band) : t.notAssessed}
                        {row.band_set_by_rule ? <span className="text-muted-foreground"> ({t.byRule})</span> : null}
                      </td>
                      <td className={td}>{row.dd_level ? ddLevelShortLabel(row.dd_level) : t.noCheck}</td>
                      <td className={td}>{statusText(row)}</td>
                      <td className={td}>{row.assessed_at ? formatDate(row.assessed_at) : t.noCheck}</td>
                      <td className={td}>
                        {row.next_review_due ? formatDate(row.next_review_due) : t.noCheck}
                        {row.review_due_in_days !== null && row.review_due_in_days < 0 ? (
                          <span className="font-semibold text-destructive"> ({t.overdue})</span>
                        ) : null}
                      </td>
                      <td className={`${td} text-right font-mono tabular-nums`}>{row.transaction_triggers_hit ?? t.noCheck}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
