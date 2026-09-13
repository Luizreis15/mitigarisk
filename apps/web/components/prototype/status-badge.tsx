import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleDashedIcon,
  InfoIcon,
  ShieldAlertIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  caseStatusLabels,
  healthLabels,
  qualityLabels,
  riskBandLabels,
  severityLabels,
} from '@/lib/demo/labels';
import type {
  AlertSeverity,
  CaseStatus,
  DataQuality,
  RiskBand,
  TenantHealth,
} from '@/lib/demo/types';

const toneClass = {
  low: 'border-[#bcd7d0] bg-[#dcebe8] text-[#244b5a]',
  medium: 'border-[#ead9b8] bg-[#f4ead8] text-[#6b5328]',
  high: 'border-[#e2c4c2] bg-[#f3e4e2] text-[#7a3f45]',
  info: 'border-[#c5d4dc] bg-[#e4edf2] text-[#3d5566]',
  success: 'border-[#bcd7d0] bg-[#dcebe8] text-[#244b5a]',
  warning: 'border-[#ead9b8] bg-[#f4ead8] text-[#6b5328]',
  danger: 'border-[#e2c4c2] bg-[#f3e4e2] text-[#7a3f45]',
};

function StatusFrame({
  label,
  icon,
  tone,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  tone: keyof typeof toneClass;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-auto gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-[0.7rem] font-medium',
        toneClass[tone],
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </Badge>
  );
}

export function RiskStatus({ band }: { band: RiskBand }) {
  const icon =
    band === 'low' ? (
      <CheckCircle2Icon aria-hidden="true" />
    ) : band === 'medium' ? (
      <AlertTriangleIcon aria-hidden="true" />
    ) : (
      <ShieldAlertIcon aria-hidden="true" />
    );

  return (
    <StatusFrame
      label={riskBandLabels[band]}
      icon={icon}
      tone={band}
    />
  );
}

export function QualityStatus({ quality }: { quality: DataQuality }) {
  return (
    <StatusFrame
      label={qualityLabels[quality]}
      icon={
        quality === 'complete' ? (
          <CheckCircle2Icon aria-hidden="true" />
        ) : (
          <CircleDashedIcon aria-hidden="true" />
        )
      }
      tone={
        quality === 'complete'
          ? 'success'
          : quality === 'partial'
            ? 'warning'
            : 'danger'
      }
    />
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const tone: keyof typeof toneClass =
    status === 'closed'
      ? 'success'
      : status === 'escalated' || status === 'waiting_evidence'
        ? 'danger'
        : status === 'in_review'
          ? 'info'
          : 'warning';

  return (
    <StatusFrame
      label={caseStatusLabels[status]}
      icon={<CircleAlertIcon aria-hidden="true" />}
      tone={tone}
    />
  );
}

export function HealthStatus({ health }: { health: TenantHealth }) {
  return (
    <StatusFrame
      label={healthLabels[health]}
      icon={
        health === 'healthy' ? (
          <CheckCircle2Icon aria-hidden="true" />
        ) : (
          <AlertTriangleIcon aria-hidden="true" />
        )
      }
      tone={
        health === 'healthy'
          ? 'success'
          : health === 'degraded'
            ? 'warning'
            : 'danger'
      }
    />
  );
}

export function SeverityStatus({ severity }: { severity: AlertSeverity }) {
  return (
    <StatusFrame
      label={severityLabels[severity]}
      icon={<InfoIcon aria-hidden="true" />}
      tone={severity}
    />
  );
}
