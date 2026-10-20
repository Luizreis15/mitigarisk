import Link from 'next/link';

import type { AuditEventRow } from '@/lib/domain/audit-event';
import type { CompanyDashboardSnapshot } from '@/lib/domain/workspace-dashboard';
import type { UserId } from '@/lib/domain/ids';
import { auditActionLabel, shortActorId } from '@/lib/i18n/access';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';
import { cn } from '@/lib/utils';

type KpiTone = 'default' | 'low' | 'medium' | 'high' | 'warn';

function KpiCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: KpiTone;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card px-4 py-4 shadow-[var(--shadow-xs)]',
        tone === 'low' && 'border-l-4 border-l-[var(--mitiga-success)]',
        tone === 'medium' && 'border-l-4 border-l-[var(--mitiga-warning)]',
        tone === 'high' && 'border-l-4 border-l-[var(--mitiga-danger)]',
        tone === 'warn' && 'border-l-4 border-l-[var(--mitiga-warning)]',
      )}
    >
      <p className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function WorkspaceDashboard({
  snapshot,
  snapshotUnavailable,
  recentEvents,
  canViewAudit,
  currentUserId,
  customersHref,
}: {
  snapshot: CompanyDashboardSnapshot | null;
  snapshotUnavailable: boolean;
  recentEvents: AuditEventRow[];
  canViewAudit: boolean;
  currentUserId: UserId | null;
  customersHref: string | null;
}) {
  const t = messages.realShell.dashboard;

  return (
    <div className="space-y-8">
      <section aria-label={t.kpiLabel} className="space-y-3">
        {snapshotUnavailable || !snapshot ? (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {t.kpiUnavailable}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label={t.customersTotal} value={snapshot.customerTotal} />
              <KpiCard label={t.bandLow} value={snapshot.bandLow} tone="low" />
              <KpiCard label={t.bandMedium} value={snapshot.bandMedium} tone="medium" />
              <KpiCard label={t.bandHigh} value={snapshot.bandHigh} tone="high" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard label={t.unassessed} value={snapshot.unassessed} />
              <KpiCard label={t.rejects} value={snapshot.rejectCount} tone="high" />
              <KpiCard
                label={interpolate(t.reviewsDue, {
                  days: String(snapshot.reviewHorizonDays),
                })}
                value={snapshot.reviewsDueCount}
                tone="warn"
              />
            </div>
            {customersHref ? (
              <p className="text-sm text-muted-foreground">
                <Link
                  href={customersHref}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {t.openCustomers}
                </Link>
              </p>
            ) : null}
          </>
        )}
      </section>

      <section aria-label={t.recentLabel} className="space-y-3">
        <h2 className="text-base font-medium text-foreground">{t.recentTitle}</h2>
        {!canViewAudit ? (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {t.recentUnavailable}
          </p>
        ) : recentEvents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
            {t.recentEmpty}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {recentEvents.map((event) => {
              const who =
                currentUserId && event.actorId === currentUserId
                  ? messages.accessWorkspace.you
                  : shortActorId(event.actorId);
              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {auditActionLabel(event.action)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {who}
                      {event.targetType
                        ? ` · ${event.targetType}${
                            event.targetId ? ` · ${event.targetId.slice(0, 8)}` : ''
                          }`
                        : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(event.occurredAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
