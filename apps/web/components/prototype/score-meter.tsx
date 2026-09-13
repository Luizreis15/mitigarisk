import type { RiskBand } from '@/lib/demo/types';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatScore } from '@/lib/i18n/presentation';

export function ScoreMeter({
  score,
  band,
  label,
}: {
  score: number;
  band: RiskBand;
  label: string;
}) {
  const gradient =
    band === 'high'
      ? 'var(--gradient-risk-high)'
      : 'var(--gradient-risk-low)';

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="font-mono text-sm tabular-nums text-foreground">
          {formatScore(score)}
        </p>
      </div>
      <meter
        className="block h-2 w-full overflow-hidden rounded-full bg-muted [&::-webkit-meter-bar]:rounded-full [&::-webkit-meter-bar]:bg-muted [&::-webkit-meter-optimum-value]:rounded-full [&::-webkit-meter-suboptimum-value]:rounded-full [&::-webkit-meter-even-less-good-value]:rounded-full"
        min={0}
        max={100}
        value={score}
        style={{ backgroundImage: gradient }}
      >
        {interpolate(messages.score.ofTotal, {
          label,
          score,
          max: 100,
        })}
      </meter>
    </div>
  );
}
