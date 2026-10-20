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
    card: 'border-[color-mix(in_srgb,var(--mitiga-info)_28%,transparent)] bg-[image:var(--gradient-risk-neutral)]',
    iconWrap: 'bg-white/70 text-[var(--mitiga-risk-neutral-fg)]',
    value: 'text-[var(--mitiga-risk-neutral-fg)]',
    Icon: UsersIcon,
  },
  low: {
    card: 'border-[color-mix(in_srgb,var(--mitiga-success)_35%,transparent)] bg-[image:var(--gradient-risk-low)]',
    iconWrap: 'bg-white/70 text-[var(--mitiga-risk-low-fg)]',
    value: 'text-[var(--mitiga-risk-low-fg)]',
    Icon: CheckCircle2Icon,
  },
  medium: {
    card: 'border-[color-mix(in_srgb,var(--mitiga-warning)_40%,transparent)] bg-[image:var(--gradient-risk-medium)]',
    iconWrap: 'bg-white/70 text-[var(--mitiga-risk-medium-fg)]',
    value: 'text-[var(--mitiga-risk-medium-fg)]',
    Icon: AlertTriangleIcon,
  },
  high: {
    card: 'border-[color-mix(in_srgb,var(--mitiga-danger)_40%,transparent)] bg-[image:var(--gradient-risk-high)]',
    iconWrap: 'bg-white/70 text-[var(--mitiga-risk-high-fg)]',
    value: 'text-[var(--mitiga-risk-high-fg)]',
    Icon: ShieldAlertIcon,
  },
  warn: {
    card: 'border-[color-mix(in_srgb,var(--mitiga-warning)_40%,transparent)] bg-[image:var(--gradient-risk-medium)]',
    iconWrap: 'bg-white/70 text-[var(--mitiga-risk-medium-fg)]',
    value: 'text-[var(--mitiga-risk-medium-fg)]',
    Icon: Clock3Icon,
  },
  reject: {
    card: 'border-[color-mix(in_srgb,var(--mitiga-danger)_45%,transparent)] bg-[image:var(--gradient-risk-high)]',
    iconWrap: 'bg-white/70 text-[var(--mitiga-risk-high-fg)]',
    value: 'text-[var(--mitiga-risk-high-fg)]',
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
        'relative overflow-hidden rounded-2xl border px-4 py-4 shadow-[var(--shadow-sm)]',
        style.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-semibold tracking-[0.1em] text-[color-mix(in_srgb,var(--mitiga-ink-950)_72%,transparent)] uppercase">
          {label}
        </p>
        <span
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
            style.iconWrap,
          )}
        >
          <style.Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p
        className={cn(
          'mt-3 text-4xl font-semibold tracking-tight tabular-nums',
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
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{t.mixLabel}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {snapshot.customerTotal} {t.customersTotal.toLowerCase()}
        </p>
      </div>
      <div
        className="flex h-3.5 overflow-hidden rounded-full bg-muted"
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
            <div className="overflow-hidden rounded-2xl bg-[image:var(--gradient-brand)] p-5 text-white shadow-[var(--shadow-md)] sm:p-6">
              <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-white/70 uppercase">
                {t.heroEyebrow}
              </p>
              <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {interpolate(t.heroTitle, {
                    count: String(snapshot.customerTotal),
                  })}
                </h2>
                {customersHref ? (
                  <Button
                    className="h-11 min-h-11 w-full bg-white text-[var(--mitiga-petrol-800)] hover:bg-white/90 sm:w-auto"
                    render={<Link href={customersHref} />}
                  >
                    {t.openCustomers}
                    <ArrowRightIcon aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
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

      <section aria-label={t.recentLabel} className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t.recentTitle}</h2>
        {!canViewAudit ? (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {t.recentUnavailable}
          </p>
        ) : recentEvents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
            {t.recentEmpty}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-xs)]">
            {recentEvents.map((event, index) => {
              const who =
                currentUserId && event.actorId === currentUserId
                  ? messages.accessWorkspace.you
                  : shortActorId(event.actorId);
              return (
                <li
                  key={event.id}
                  className={cn(
                    'flex flex-col gap-1 border-l-4 border-l-[var(--mitiga-petrol-700)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
                    index > 0 && 'border-t border-t-border',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
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
