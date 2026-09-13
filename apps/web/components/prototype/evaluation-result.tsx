import Link from 'next/link';

import {
  QualityStatus,
  RiskStatus,
} from '@/components/prototype/status-badge';
import type { DemoEvaluation } from '@/lib/demo/types';
import { presentation } from '@/lib/demo/data';
import { getPolicy } from '@/lib/demo/policy-workbench';
import { messages } from '@/lib/i18n/messages';
import { formatDateTime, formatNumber } from '@/lib/i18n/presentation';

export function EvaluationResult({ evaluation }: { evaluation: DemoEvaluation }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <div>
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.scoreLabel}
        </dt>
        <dd className="mt-1 font-mono text-2xl tabular-nums">
          {formatNumber(evaluation.score, presentation)}
        </dd>
      </div>
      <div>
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.bandLabel}
        </dt>
        <dd className="mt-1">
          <RiskStatus band={evaluation.band} />
        </dd>
      </div>
      <div>
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.qualityLabel}
        </dt>
        <dd className="mt-1 space-y-2">
          <QualityStatus quality={evaluation.quality} />
          <p className="text-sm text-muted-foreground">{messages.flow.qualityDistinct}</p>
        </dd>
      </div>
      <div>
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.reasonsLabel}
        </dt>
        <dd className="mt-1 space-y-2">
          <p className="font-mono text-sm">{evaluation.reasons.join(', ')}</p>
          <p className="text-sm text-muted-foreground">{messages.flow.reasonCodesHint}</p>
        </dd>
      </div>
      <div>
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.policyLabel}
        </dt>
        <dd className="mt-1">
          {getPolicy(evaluation.policyVersion) ? (
            <Link
              className="font-mono text-sm underline-offset-4 hover:underline"
              href={`/policies/${evaluation.policyVersion}`}
            >
              {evaluation.policyVersion}
            </Link>
          ) : (
            <span className="font-mono text-sm">{evaluation.policyVersion}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.whenLabel}
        </dt>
        <dd className="mt-1 text-sm">
          {formatDateTime(evaluation.evaluatedAt, presentation)}
        </dd>
      </div>
      <div>
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.actorLabel}
        </dt>
        <dd className="mt-1 font-mono text-sm">{evaluation.actor}</dd>
      </div>
      <div>
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.correlationLabel}
        </dt>
        <dd className="mt-1 font-mono text-sm">{evaluation.correlationId}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {messages.flow.evaluation.recommendationLabel}
        </dt>
        <dd className="mt-1 text-sm leading-6">{evaluation.recommendation}</dd>
        <p className="mt-2 text-sm text-muted-foreground">
          {messages.flow.evaluation.provenanceHint}
        </p>
      </div>
    </dl>
  );
}
