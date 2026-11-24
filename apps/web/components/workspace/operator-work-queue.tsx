import Link from 'next/link';
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  HourglassIcon,
  OctagonXIcon,
  PlusIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CustomerBandBadge } from '@/components/workspace/customer-band-badge';
import { ddLevelShortLabel, requiredActionLabel } from '@/lib/i18n/customer-assessment';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDate } from '@/lib/i18n/presentation';
import { cn } from '@/lib/utils';
import { WORK_STAGE_ORDER, type WorkQueue, type WorkQueueItem, type WorkStage } from '@/lib/domain/work-queue';

const t = messages.workQueue;

const stageStyle: Record<WorkStage, { icon: LucideIcon; accent: string; chip: string }> = {
  do_not_onboard: {
    icon: OctagonXIcon,
    accent: 'bg-[var(--mitiga-danger)]',
    chip: 'bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]',
  },
  needs_assessment: {
    icon: ClipboardListIcon,
    accent: 'bg-[var(--mitiga-violet-500)]',
    chip: 'bg-[var(--mitiga-violet-100)] text-[var(--mitiga-violet-500)]',
  },
  review_due: {
    icon: CalendarClockIcon,
    accent: 'bg-[var(--mitiga-warning)]',
    chip: 'bg-[var(--mitiga-risk-medium-bg)] text-[var(--mitiga-risk-medium-fg)]',
  },
  awaiting_compliance: {
    icon: HourglassIcon,
    accent: 'bg-[var(--mitiga-info)]',
    chip: 'bg-[var(--mitiga-mineral-100)] text-[var(--mitiga-petrol-700)]',
  },
  cleared: {
    icon: CheckCircle2Icon,
    accent: 'bg-[var(--mitiga-success)]',
    chip: 'bg-[var(--mitiga-risk-low-bg)] text-[var(--mitiga-risk-low-fg)]',
  },
};

function dueText(item: WorkQueueItem): string {
  if (!item.latest) return t.notAssessed;
  const days = item.reviewDueInDays;
  if (item.stage === 'review_due' && days !== null) {
    if (days === 0) return t.dueToday;
    if (days < 0) return interpolate(t.overdueBy, { days: String(-days) });
    return interpolate(t.dueIn, { days: String(days) });
  }
  if (item.stage === 'do_not_onboard' || item.stage === 'awaiting_compliance') {
    return interpolate(t.assessedOn, { date: formatDate(item.latest.assessedAt) });
  }
  return interpolate(t.nextReview, { date: formatDate(item.latest.nextReviewDue) });
}

function QueueRow({ item, href }: { item: WorkQueueItem; href: string }) {
  const style = stageStyle[item.stage];
  const actions = item.requiredActions;
  const shown = actions.slice(0, 2);
  const hidden = actions.length - shown.length;

  return (
    <li>
      <Link
        href={href}
        className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card py-3 pr-4 pl-5 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--mitiga-mineral-600)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-row sm:items-center"
      >
        <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', style.accent)} />
        <div className="min-w-0 sm:w-56 sm:shrink-0">
          <p className="truncate font-medium text-foreground">{item.customer.fullName}</p>
          <p className="text-xs text-muted-foreground">{item.customer.externalReference}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:w-36">
          {item.latest ? (
            <>
              <CustomerBandBadge band={item.latest.band} />
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                {ddLevelShortLabel(item.latest.ddLevel)}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{t.notAssessed}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {(item.triggerActions ?? []).length > 0 && (item.stage === 'cleared' || item.stage === 'review_due')
              ? t.triggerNext
              : t.stages[item.stage].next}
          </p>
          {(item.triggerActions ?? []).length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {(item.triggerActions ?? []).map((code) => (
                <li
                  key={code}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--mitiga-risk-medium-bg)] px-2 py-0.5 text-xs font-medium text-[var(--mitiga-risk-medium-fg)]"
                >
                  <ZapIcon className="size-3" aria-hidden="true" />
                  {interpolate(t.triggerChip, {
                    action: (messages.transactionTriggers.actions as Record<string, string>)[code] ?? code,
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          {shown.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {shown.map((code) => (
                <li key={code} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {requiredActionLabel(code)}
                </li>
              ))}
              {hidden > 0 ? (
                <li className="px-1 py-0.5 text-xs text-muted-foreground">
                  {interpolate(t.moreActions, { count: String(hidden) })}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <span
            className={cn(
              'text-xs',
              item.stage === 'review_due' && (item.reviewDueInDays ?? 1) < 0
                ? 'font-medium text-[var(--mitiga-danger)]'
                : 'text-muted-foreground',
            )}
          >
            {dueText(item)}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--mitiga-petrol-700)]">
            {t.open}
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </li>
  );
}

export function OperatorWorkQueue({
  queue,
  tenantId,
  canCreate,
  unavailable,
}: {
  queue: WorkQueue | null;
  tenantId: string;
  canCreate: boolean;
  unavailable: boolean;
}) {
  const customerHref = (id: string) => `/workspace/customers/${id}?tenant=${tenantId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {queue
            ? interpolate(t.openSummary, { open: String(queue.openCount), total: String(queue.items.length) })
            : null}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10" render={<Link href={`/workspace/customers?tenant=${tenantId}`} />}>
            {t.allCustomers}
          </Button>
          {canCreate ? (
            <Button className="h-10" render={<Link href={`/workspace/customers/new?tenant=${tenantId}`} />}>
              <PlusIcon aria-hidden="true" />
              {t.newCustomer}
            </Button>
          ) : null}
        </div>
      </div>

      {unavailable || !queue ? (
        <p role="alert" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {t.unavailable}
        </p>
      ) : queue.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="font-medium">{t.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.emptyBody}</p>
        </div>
      ) : (
        <>
          <nav aria-label={t.title} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {WORK_STAGE_ORDER.map((stage) => {
              const style = stageStyle[stage];
              const Icon = style.icon;
              const count = queue.counts[stage];
              return (
                <a
                  key={stage}
                  href={`#stage-${stage}`}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--mitiga-mineral-600)]',
                    count === 0 && 'opacity-60',
                  )}
                >
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', style.chip)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xl leading-6 font-semibold tabular-nums">{count}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.stages[stage].title}</span>
                  </span>
                </a>
              );
            })}
          </nav>

          {WORK_STAGE_ORDER.map((stage) => {
            const items = queue.items.filter((item) => item.stage === stage);
            if (items.length === 0) return null;
            return (
              <section key={stage} id={`stage-${stage}`} aria-labelledby={`stage-${stage}-title`} className="scroll-mt-24 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`stage-${stage}-title`} className="text-sm font-semibold text-foreground">
                    {t.stages[stage].title}
                    <span className="ml-2 font-normal text-muted-foreground tabular-nums">{items.length}</span>
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">{t.stages[stage].hint}</p>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <QueueRow key={item.customer.id} item={item} href={customerHref(item.customer.id)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
