import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { CaseStatusBadge, RiskStatus } from '@/components/prototype/status-badge';
import {
  evidenceStateLabels,
  humanDecisionLabels,
  nextActionLabels,
  priorityLabels,
  riskBandLabels,
} from '@/lib/demo/labels';
import type { DemoCase } from '@/lib/demo/types';
import { caseDetailHref, type WorkbenchQuery } from '@/lib/demo/workbench';
import { presentation } from '@/lib/demo/data';
import { messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';

export function WorkbenchCaseCard({
  item,
  query,
}: {
  item: DemoCase;
  query: WorkbenchQuery;
}) {
  return (
    <article className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-medium">{item.reference}</h2>
        <CaseStatusBadge status={item.status} />
        {item.riskBand ? <RiskStatus band={item.riskBand} /> : null}
      </div>
      <p className="text-sm text-muted-foreground">{item.subject}</p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {messages.workbench.owner}
          </dt>
          <dd className="mt-1 text-sm">{item.assignee}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {messages.workbench.priority}
          </dt>
          <dd className="mt-1 text-sm">{priorityLabels[item.priority]}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {messages.workbench.lastActivity}
          </dt>
          <dd className="mt-1 text-sm">
            {formatDateTime(item.lastActivityAt, presentation)}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {messages.workbench.riskBand}
          </dt>
          <dd className="mt-1 text-sm">
            {item.riskBand ? riskBandLabels[item.riskBand] : messages.workbench.noBand}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {messages.workbench.evidenceState}
          </dt>
          <dd className="mt-1 text-sm">{evidenceStateLabels[item.evidenceState]}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {messages.workbench.nextAction}
          </dt>
          <dd className="mt-1 text-sm">{nextActionLabels[item.nextAction]}</dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {messages.workbench.decision}
          </dt>
          <dd className="mt-1 text-sm">
            {item.recordedDecision
              ? humanDecisionLabels[item.recordedDecision]
              : messages.workbench.noDecision}
          </dd>
        </div>
      </dl>
      <div>
        <Button className="h-11" render={<Link href={caseDetailHref(item.id, query)} />}>
          {messages.workbench.openCase}
        </Button>
      </div>
    </article>
  );
}
