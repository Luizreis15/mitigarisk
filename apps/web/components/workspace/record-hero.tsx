import type { ReactNode } from 'react';

import { CustomerBandBadge } from '@/components/workspace/customer-band-badge';
import { ScoreSpectrum } from '@/components/workspace/risk-spectrum';
import type { CraBandName } from '@/lib/domain/cra-engine';
import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

const t = messages.recordHero;

const statusTone = {
  neutral: 'bg-muted text-foreground',
  good: 'bg-[var(--mitiga-risk-low-bg)] text-[var(--mitiga-risk-low-fg)]',
  wait: 'bg-[var(--mitiga-risk-medium-bg)] text-[var(--mitiga-risk-medium-fg)]',
  bad: 'bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]',
} as const;

export type HeroStatusTone = keyof typeof statusTone;

/** The record's identity and its risk position, always above the tabs. */
export function RecordHero({
  reference,
  meta,
  risk,
  status,
  actions,
}: {
  reference: string;
  meta: string;
  risk: { score: number; band: CraBandName; ddLabel: string; overrideLabels: string[] } | null;
  status: { label: string; tone: HeroStatusTone };
  actions?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{reference}</span>
          <span className="mx-2 text-border">|</span>
          {meta}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', statusTone[status.tone])}>{status.label}</span>
          {actions}
        </div>
      </div>
      {risk ? (
        <div className="grid gap-x-8 gap-y-4 px-5 py-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[0.7rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{t.score}</p>
              <p className="font-mono text-[2.75rem] leading-none font-medium tracking-tight">{risk.score}</p>
            </div>
            <div className="space-y-1.5 pb-1">
              <CustomerBandBadge band={risk.band} />
              <p className="text-xs font-medium text-muted-foreground">{risk.ddLabel}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <ScoreSpectrum score={risk.score} band={risk.band} overridden={risk.overrideLabels.length > 0} />
            {risk.overrideLabels.length > 0 ? (
              <p className="text-xs text-[var(--mitiga-risk-high-fg)]">
                <span className="font-semibold">{t.overrideLead}</span> {risk.overrideLabels.join(' · ')}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="px-5 py-5 text-sm text-muted-foreground">{t.notAssessed}</p>
      )}
    </section>
  );
}
