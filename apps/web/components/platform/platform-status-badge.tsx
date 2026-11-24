import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

const tone: Record<string, string> = {
  active: 'bg-[var(--mitiga-risk-low-bg)] text-[var(--mitiga-risk-low-fg)]',
  suspended: 'bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]',
  invited: 'bg-[var(--mitiga-mineral-100)] text-[var(--mitiga-petrol-700)]',
  removed: 'bg-muted text-muted-foreground',
};

export function PlatformStatusBadge({ status }: { status: string }) {
  const label = (messages.platform.statuses as Record<string, string>)[status] ?? status;
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tone[status] ?? tone.removed)}>{label}</span>
  );
}
