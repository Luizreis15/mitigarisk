import Link from 'next/link';
import { ArrowRightIcon, GavelIcon, HourglassIcon } from 'lucide-react';

import { CustomerBandBadge } from '@/components/workspace/customer-band-badge';
import { ddLevelShortLabel } from '@/lib/i18n/customer-assessment';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDate } from '@/lib/i18n/presentation';
import type { Customer } from '@/lib/domain/customer';
import type { CustomerAssessment } from '@/lib/domain/customer-assessment';
import type { CustomerDecisionLevel } from '@/lib/domain/customer-decision';

const t = messages.decisionInbox;

export interface DecisionInboxItem {
  customer: Customer;
  latest: CustomerAssessment;
  pendingLevel: CustomerDecisionLevel;
}

export function DecisionInbox({
  items,
  tenantId,
  mode,
}: {
  items: DecisionInboxItem[];
  tenantId: string;
  mode: 'mlro' | 'analyst';
}) {
  const title = mode === 'mlro' ? t.mlroTitle : t.analystTitle;

  return (
    <section aria-labelledby="decision-inbox-title" className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--mitiga-mineral-100)] text-[var(--mitiga-petrol-700)]">
          <GavelIcon className="size-4" aria-hidden="true" />
        </span>
        <h2 id="decision-inbox-title" className="font-semibold">
          {title}
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">{items.length}</span>
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{mode === 'mlro' ? t.mlroEmpty : t.analystEmpty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.customer.id}>
              <Link
                href={`/workspace/customers/${item.customer.id}?tenant=${tenantId}#customer-decision`}
                className="group flex flex-wrap items-center gap-3 py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-nowrap"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.customer.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.customer.externalReference} ·{' '}
                    {interpolate(messages.workQueue.assessedOn, { date: formatDate(item.latest.assessedAt) })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CustomerBandBadge band={item.latest.band} />
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                    {ddLevelShortLabel(item.latest.ddLevel)}
                  </span>
                  {item.pendingLevel === 'board' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--mitiga-risk-medium-bg)] px-1.5 py-0.5 text-[0.7rem] font-medium text-[var(--mitiga-risk-medium-fg)]">
                      <HourglassIcon className="size-3" aria-hidden="true" />
                      {t.board}
                    </span>
                  ) : null}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--mitiga-petrol-700)]">
                  {mode === 'mlro' ? t.open : t.view}
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
