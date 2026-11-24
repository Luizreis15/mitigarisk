import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRightIcon, CalendarClockIcon, ClipboardListIcon, GavelIcon, ZapIcon, type LucideIcon } from 'lucide-react';

import { PortfolioSpectrum } from '@/components/workspace/risk-spectrum';
import type { AuditEventRow } from '@/lib/domain/audit-event';
import type { CompanyDashboardSnapshot, PortfolioPoint } from '@/lib/domain/workspace-dashboard';
import type { UserId } from '@/lib/domain/ids';
import { auditActionLabel, shortActorId } from '@/lib/i18n/access';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';
import { cn } from '@/lib/utils';

const t = messages.overview;
const legacy = messages.realShell.dashboard;

export interface OverviewAttention {
  awaitingDecision: number;
  openTriggers: number;
}

function AttentionTile({
  label,
  hint,
  value,
  icon: Icon,
  href,
  accent,
}: {
  label: string;
  hint: string;
  value: number;
  icon: LucideIcon;
  href: string | null;
  accent: string;
}) {
  const active = value > 0;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex size-7 items-center justify-center rounded-md', active ? 'text-white' : 'bg-muted text-muted-foreground')} style={active ? { background: accent } : undefined}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className={cn('mt-3 font-mono text-[2rem] leading-none font-medium tracking-tight', !active && 'text-muted-foreground/70')}>{value}</p>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>
    </>
  );
  const className = cn(
    'relative block overflow-hidden rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] duration-[var(--duration-fast)]',
    active ? 'border-border' : 'border-border/70',
    href && 'hover:border-[var(--mitiga-petrol-700)] hover:shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );
  return href ? (
    <Link href={href} className={className}>
      {active ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} /> : null}
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Panel({ title, action, children, className, id }: { title: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-[0.95rem] font-semibold">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SplitBar({ items }: { items: Array<{ label: string; count: number; color: string }> }) {
  const total = Math.max(1, items.reduce((sum, item) => sum + item.count, 0));
  return (
    <div className="space-y-2">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {items.filter((i) => i.count > 0).map((item) => (
          <span key={item.label} className="h-full" style={{ width: `${(item.count / total) * 100}%`, background: item.color }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: item.color }} aria-hidden="true" />
            <span className="font-mono font-medium text-foreground">{item.count}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkspaceDashboard({
  snapshot,
  snapshotUnavailable,
  points,
  attention,
  recentEvents,
  canViewAudit,
  currentUserId,
  customersHref,
  accessHref,
  tenantId,
  inbox,
}: {
  snapshot: CompanyDashboardSnapshot | null;
  snapshotUnavailable: boolean;
  points: PortfolioPoint[];
  attention: OverviewAttention;
  recentEvents: AuditEventRow[];
  canViewAudit: boolean;
  currentUserId: UserId | null;
  customersHref: string | null;
  accessHref: string | null;
  tenantId: string | null;
  inbox: ReactNode;
}) {
  if (snapshotUnavailable || !snapshot) {
    return <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{legacy.kpiUnavailable}</p>;
  }

  const dd = (level: PortfolioPoint['ddLevel']) => points.filter((p) => p.ddLevel === level).length;
  const linkAll = customersHref ? (
    <Link href={customersHref} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--mitiga-petrol-700)] hover:underline">
      {t.allCustomers}
      <ArrowRightIcon className="size-3.5" aria-hidden="true" />
    </Link>
  ) : null;

  return (
    <div className="space-y-6">
      <section aria-label={t.attention} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <AttentionTile label={t.tiles.decisions} hint={t.tiles.decisionsHint} value={attention.awaitingDecision} icon={GavelIcon} href="#decision-inbox" accent="var(--risk-high)" />
        <AttentionTile label={t.tiles.triggers} hint={t.tiles.triggersHint} value={attention.openTriggers} icon={ZapIcon} href={customersHref} accent="var(--risk-medium)" />
        <AttentionTile label={t.tiles.unassessed} hint={t.tiles.unassessedHint} value={snapshot.unassessed} icon={ClipboardListIcon} href={customersHref} accent="var(--mitiga-violet-500)" />
        <AttentionTile
          label={t.tiles.reviews}
          hint={interpolate(t.tiles.reviewsHint, { days: String(snapshot.reviewHorizonDays) })}
          value={snapshot.reviewsDueCount}
          icon={CalendarClockIcon}
          href={customersHref}
          accent="var(--mitiga-petrol-700)"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel title={t.spectrumTitle} action={linkAll} className="xl:col-span-7">
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.spectrumEmpty}</p>
          ) : (
            <div className="space-y-6">
              <p className="-mt-1 text-xs text-muted-foreground">{t.spectrumIntro}</p>
              <PortfolioSpectrum points={points} hrefFor={(id) => `/workspace/customers/${id}?tenant=${tenantId ?? ''}`} />
              <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{t.bandsTitle}</h3>
                  <SplitBar
                    items={[
                      { label: legacy.bandLow, count: snapshot.bandLow, color: 'var(--risk-low)' },
                      { label: legacy.bandMedium, count: snapshot.bandMedium, color: 'var(--risk-medium)' },
                      { label: legacy.bandHigh, count: snapshot.bandHigh, color: 'var(--risk-high)' },
                    ]}
                  />
                  {snapshot.rejectCount > 0 ? (
                    <p className="text-xs font-medium text-[var(--mitiga-risk-high-fg)]">{interpolate(t.rejected, { count: String(snapshot.rejectCount) })}</p>
                  ) : null}
                </div>
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{t.ddTitle}</h3>
                  <SplitBar
                    items={[
                      { label: `${t.dd.SDD} (SDD)`, count: dd('SDD'), color: 'var(--mitiga-mineral-600)' },
                      { label: `${t.dd.CDD} (CDD)`, count: dd('CDD'), color: 'var(--mitiga-petrol-700)' },
                      { label: `${t.dd.EDD} (EDD)`, count: dd('EDD'), color: 'var(--mitiga-violet-500)' },
                    ]}
                  />
                </div>
              </div>
            </div>
          )}
        </Panel>

        <div className="space-y-6 xl:col-span-5">
          {inbox}
          <Panel
            title={t.activityTitle}
            action={
              canViewAudit && accessHref ? (
                <Link href={accessHref} className="text-sm font-medium text-[var(--mitiga-petrol-700)] hover:underline">
                  {t.activityAll}
                </Link>
              ) : undefined
            }
          >
            {!canViewAudit ? (
              <p className="text-sm text-muted-foreground">{legacy.recentUnavailable}</p>
            ) : recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{legacy.recentEmpty}</p>
            ) : (
              <ol className="relative space-y-4 before:absolute before:top-1.5 before:bottom-1.5 before:left-[3px] before:w-px before:bg-border">
                {recentEvents.map((event) => (
                  <li key={event.id} className="relative pl-5">
                    <span aria-hidden="true" className="absolute top-1.5 left-0 size-[7px] rounded-full bg-[var(--mitiga-petrol-700)] ring-2 ring-card" />
                    <p className="text-sm leading-snug font-medium">{auditActionLabel(event.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentUserId && event.actorId === currentUserId ? messages.accessWorkspace.you : shortActorId(event.actorId)} ·{' '}
                      <span className="font-mono">{formatDateTime(event.occurredAt)}</span>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
