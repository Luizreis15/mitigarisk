import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ShieldAlertIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { bandLabel } from '@/lib/i18n/customer-assessment';
import type { CraBandName } from '@/lib/domain/cra-engine';

// Same tone palette as the prototype RiskStatus badge, so risk bands read
// identically across MITIGA. The label is always rendered as text: colour is
// never the only signal.
const toneClass: Record<CraBandName, string> = {
  LOW: 'border-[color-mix(in_srgb,var(--mitiga-success)_45%,transparent)] bg-[var(--mitiga-risk-low-bg)] text-[var(--mitiga-risk-low-fg)]',
  MEDIUM:
    'border-[color-mix(in_srgb,var(--mitiga-warning)_45%,transparent)] bg-[var(--mitiga-risk-medium-bg)] text-[var(--mitiga-risk-medium-fg)]',
  HIGH: 'border-[color-mix(in_srgb,var(--mitiga-danger)_45%,transparent)] bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]',
}

export function CustomerBandBadge({
  band,
  className,
}: {
  band: CraBandName;
  className?: string;
}) {
  const icon =
    band === 'LOW' ? (
      <CheckCircle2Icon aria-hidden="true" />
    ) : band === 'MEDIUM' ? (
      <AlertTriangleIcon aria-hidden="true" />
    ) : (
      <ShieldAlertIcon aria-hidden="true" />
    );
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-auto gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-[0.7rem] font-medium',
        toneClass[band],
        className,
      )}
    >
      {icon}
      <span>{bandLabel(band)}</span>
    </Badge>
  );
}
