import Link from 'next/link';

import { BAND_THRESHOLDS, type PortfolioPoint } from '@/lib/domain/workspace-dashboard';
import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

// MITIGA's signature instrument: the calibrated risk scale. Zones follow
// the policy thresholds (36 and 76); each customer sits at its stored
// score. A diamond marks a band forced by an override rule, so "high by
// score" and "high by rule" read differently at a glance.

const t = messages.riskSpectrum;

const bandColor = { LOW: 'var(--risk-low)', MEDIUM: 'var(--risk-medium)', HIGH: 'var(--risk-high)' } as const;

const ZONES = [
  { key: 'LOW', from: 0, to: BAND_THRESHOLDS.medium, bg: 'var(--mitiga-risk-low-bg)', fg: 'var(--mitiga-risk-low-fg)' },
  { key: 'MEDIUM', from: BAND_THRESHOLDS.medium, to: BAND_THRESHOLDS.high, bg: 'var(--mitiga-risk-medium-bg)', fg: 'var(--mitiga-risk-medium-fg)' },
  { key: 'HIGH', from: BAND_THRESHOLDS.high, to: 100, bg: 'var(--mitiga-risk-high-bg)', fg: 'var(--mitiga-risk-high-fg)' },
] as const;

const STEP = 18;

export function PortfolioSpectrum({ points, hrefFor }: { points: PortfolioPoint[]; hrefFor: (customerId: string) => string }) {
  const maxStack = points.reduce((max, p) => Math.max(max, p.stack), 0);
  const plotHeight = Math.max(96, (maxStack + 1) * STEP + 48);

  return (
    <figure className="space-y-2">
      <div className="relative" style={{ height: plotHeight }}>
        <div className="absolute inset-0 flex overflow-hidden rounded-md" aria-hidden="true">
          {ZONES.map((zone) => (
            <div key={zone.key} className="relative h-full border-r border-white last:border-r-0" style={{ width: `${zone.to - zone.from}%`, background: zone.bg }}>
              <span className="absolute top-2 right-2.5 text-[0.65rem] font-semibold tracking-[0.1em] uppercase" style={{ color: zone.fg }}>
                {t.zones[zone.key]}
              </span>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-2 inset-y-0">
          {points.map((point) => (
            <Link
              key={point.customerId}
              href={hrefFor(point.customerId)}
              title={`${point.name} · ${point.score} · ${t.zones[point.band]}${point.overridden ? ` · ${t.override}` : ''}`}
              aria-label={`${point.name}, ${t.score} ${point.score}, ${t.zones[point.band]}`}
              className={cn(
                'absolute size-3.5 -translate-x-1/2 border-2 border-white shadow-[0_1px_3px_rgba(10,22,40,0.35)] transition-transform duration-[var(--duration-fast)] hover:z-10 hover:scale-150 focus-visible:z-10 focus-visible:scale-150',
                point.overridden ? 'rotate-45 rounded-[2px]' : 'rounded-full',
              )}
              style={{ left: `${point.score}%`, bottom: 10 + point.stack * STEP, background: bandColor[point.band] }}
            />
          ))}
        </div>
      </div>
      <div className="relative h-4 font-mono text-[0.68rem] text-muted-foreground" aria-hidden="true">
        {[0, BAND_THRESHOLDS.medium, BAND_THRESHOLDS.high, 100].map((tick) => (
          <span
            key={tick}
            className={cn('absolute', tick === 0 ? 'left-0' : tick === 100 ? 'right-0' : '-translate-x-1/2')}
            style={tick === 0 || tick === 100 ? undefined : { left: `${tick}%` }}
          >
            {tick}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--mitiga-slate-500)]" aria-hidden="true" />
          {t.legendScore}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rotate-45 rounded-[2px] bg-[var(--mitiga-slate-500)]" aria-hidden="true" />
          {t.legendOverride}
        </span>
      </figcaption>
    </figure>
  );
}

/** One customer's stored score on the calibrated scale. */
export function ScoreSpectrum({ score, band, overridden }: { score: number; band: keyof typeof bandColor; overridden: boolean }) {
  const position = Math.min(100, Math.max(0, score));
  return (
    <figure className="w-full space-y-1.5">
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 flex h-2.5 -translate-y-1/2 overflow-hidden rounded-full" aria-hidden="true">
          {ZONES.map((zone) => (
            <span key={zone.key} className="h-full border-r-2 border-white last:border-r-0" style={{ width: `${zone.to - zone.from}%`, background: zone.bg }} />
          ))}
        </div>
        <span className="sr-only">{`${t.score} ${score}, ${t.zones[band]}`}</span>
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 border-[3px] border-white shadow-[0_1px_4px_rgba(10,22,40,0.4)]',
            overridden ? 'rotate-45 rounded-[3px]' : 'rounded-full',
          )}
          style={{ left: `${position}%`, background: bandColor[band] }}
        />
      </div>
      <div className="relative h-4 font-mono text-[0.68rem] text-muted-foreground" aria-hidden="true">
        {[0, BAND_THRESHOLDS.medium, BAND_THRESHOLDS.high, 100].map((tick) => (
          <span
            key={tick}
            className={cn('absolute', tick === 0 ? 'left-0' : tick === 100 ? 'right-0' : '-translate-x-1/2')}
            style={tick === 0 || tick === 100 ? undefined : { left: `${tick}%` }}
          >
            {tick}
          </span>
        ))}
      </div>
    </figure>
  );
}
