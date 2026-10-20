import Link from 'next/link';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  ShieldAlertIcon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AuditEventRow } from '@/lib/domain/audit-event';
import type { CompanyDashboardSnapshot } from '@/lib/domain/workspace-dashboard';
import type { UserId } from '@/lib/domain/ids';
import { auditActionLabel, shortActorId } from '@/lib/i18n/access';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';
import { cn } from '@/lib/utils';

type KpiTone = 'neutral' | 'low' | 'medium' | 'high' | 'warn' | 'reject';

const toneStyles: Record<
  KpiTone,
  { card: string; iconWrap: string; value: string; Icon: typeof UsersIcon }
> = {
  neutral: {
    card: 'border-border bg-card',
    iconWrap: 'bg-[var(--mitiga-risk-neutral-bg)] text-[var(--mitiga-risk-neutral-fg)]',
    value: 'text-foreground',
    Icon: UsersIcon,
  },
  low: {
    card: 'border-border bg-card',
    iconWrap: 'bg-[var(--mitiga-risk-low-bg)] text-[var(--mitiga-risk-low-fg)]',
    value: 'text-foreground',
    Icon: CheckCircle2Icon,
  },
  medium: {
    card: 'border-border bg-card',
    iconWrap: 'bg-[var(--mitiga-risk-medium-bg)] text-[var(--mitiga-risk-medium-fg)]',
    value: 'text-foreground',
    Icon: AlertTriangleIcon,
  },
  high: {
    card: 'border-border bg-card',
    iconWrap: 'bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]',
    value: 'text-foreground',
    Icon: ShieldAlertIcon,
  },
  warn: {
    card: 'border-border bg-card',
    iconWrap: 'bg-[var(--mitiga-risk-medium-bg)] text-[var(--mitiga-risk-medium-fg)]',
    value: 'text-foreground',
    Icon: Clock3Icon,
  },
  reject: {
    card: 'border-border bg-card',
    iconWrap: 'bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]',
    value: 'text-foreground',
    Icon: XCircleIcon,
  },
};

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: KpiTone;
}) {
  const style = toneStyles[tone];
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border px-3.5 py-3.5 shadow-[var(--shadow-xs)]',
        style.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </p>
        <span
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-md',
            style.iconWrap,
          )}
        >
          <style.Icon className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold tracking-tight tabular-nums',
          style.value,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RiskMixBar({ snapshot }: { snapshot: CompanyDashboardSnapshot }) {
  const t = messages.realShell.dashboard;
  const total = Math.max(snapshot.customerTotal, 1);
  const segments = [
    {
      key: 'low',
      count: snapshot.bandLow,
      label: t.bandLow,
      className: 'bg-[var(--mitiga-success)]',
    },
    {
      key: 'medium',
      count: snapshot.bandMedium,
      label: t.bandMedium,
      className: 'bg-[var(--mitiga-warning)]',
    },
    {
      key: 'high',
      count: snapshot.bandHigh,
      label: t.bandHigh,
      className: 'bg-[var(--mitiga-danger)]',
    },
    {
      key: 'unassessed',
      count: snapshot.unassessed,
      label: t.unassessed,
      className: 'bg-[var(--mitiga-petrol-700)]/45',
    },
  ].filter((segment) => segment.count > 0);

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-xs)] sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{t.mixLabel}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {snapshot.customerTotal} {t.customersTotal.toLowerCase()}
        </p>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        {segments.length === 0 ? (
          <span className="w-full bg-muted" />
        ) : (
          segments.map((segment) => (
            <span
              key={segment.key}
              title={`${segment.label}: ${segment.count}`}
              className={cn('h-full min-w-[0.35rem] transition-[width]', segment.className)}
              style={{ width: `${(segment.count / total) * 100}%` }}
            />
          ))
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <li key={segment.key} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full', segment.className)} aria-hidden="true" />
            <span className="font-medium text-foreground tabular-nums">{segment.count}</span>
            {segment.label}
          </li>
        ))}
      </ul>
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
    <div className="space-y-6">
      <section aria-label={t.kpiLabel} className="space-y-4">
        {snapshotUnavailable || !snapshot ? (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {t.kpiUnavailable}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0 border-l-4 border-l-[var(--mitiga-mineral-600)] pl-3.5">
                <p className="text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {t.heroEyebrow}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {interpolate(t.heroTitle, {
                    count: String(snapshot.customerTotal),
                  })}
                </h2>
              </div>
              {customersHref ? (
                <Button
                  className="h-10 min-h-10 w-full sm:w-auto"
                  render={<Link href={customersHref} />}
                >
                  {t.openCustomers}
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              ) : null}
            </div>

            <RiskMixBar snapshot={snapshot} />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label={t.bandLow} value={snapshot.bandLow} tone="low" />
              <KpiCard label={t.bandMedium} value={snapshot.bandMedium} tone="medium" />
              <KpiCard label={t.bandHigh} value={snapshot.bandHigh} tone="high" />
              <KpiCard label={t.unassessed} value={snapshot.unassessed} tone="neutral" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiCard label={t.rejects} value={snapshot.rejectCount} tone="reject" />
              <KpiCard
                label={interpolate(t.reviewsDue, {
                  days: String(snapshot.reviewHorizonDays),
                })}
                value={snapshot.reviewsDueCount}
                tone="warn"
              />
            </div>
          </>
        )}
      </section>

      <section aria-label={t.recentLabel} className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{t.recentTitle}</h2>
        {!canViewAudit ? (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {t.recentUnavailable}
          </p>
        ) : recentEvents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
            {t.recentEmpty}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
            {recentEvents.map((event, index) => {
              const who =
                currentUserId && event.actorId === currentUserId
                  ? messages.accessWorkspace.you
                  : shortActorId(event.actorId);
              return (
                <li
                  key={event.id}
                  className={cn(
                    'flex flex-col gap-0.5 border-l-[3px] border-l-[var(--mitiga-petrol-700)]/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
                    index > 0 && 'border-t border-t-border',
                  )}
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
                  <p className="shrink-0 text-xs font-medium text-[var(--mitiga-petrol-700)] whitespace-nowrap">
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
