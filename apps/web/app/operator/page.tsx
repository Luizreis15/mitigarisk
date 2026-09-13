'use client';

import { useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AppShell } from '@/components/prototype/app-shell';
import { EmptyFilterState } from '@/components/prototype/empty-filter-state';
import { EmptyWorkspace } from '@/components/prototype/empty-workspace';
import { CaseStatusBadge } from '@/components/prototype/status-badge';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import { currentTenant, demoCases, demoEvaluations, presentation } from '@/lib/demo/data';
import { caseStatusLabels } from '@/lib/demo/labels';
import type { CaseStatus } from '@/lib/demo/types';
import { interpolate, messages } from '@/lib/i18n/messages';
import { memberships } from '@/lib/demo/session';
import { formatDateTime, formatNumber } from '@/lib/i18n/presentation';

export default function OperatorPage() {
  return (
    <Suspense>
      <OperatorContent />
    </Suspense>
  );
}

function OperatorContent() {
  const notify = usePrototypeFeedback();
  const params = useSearchParams();
  const empty = params.get('state') === 'empty';
  const capabilities = memberships.find((item) => item.id === 'mem_helix_operator')
    ?.capabilities;
  const [status, setStatus] = useState<CaseStatus | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const queue = useMemo(
    () => demoCases.filter((item) => status === 'all' || item.status === status),
    [status],
  );
  const assigned = demoCases.filter(
    (item) => item.assignee === currentTenant.operator,
  );
  const evidence = demoEvaluations.filter((item) => item.quality !== 'complete');

  const filters = (
    <div className="space-y-3">
      <Label htmlFor="filter-status">{messages.filters.queueStatus}</Label>
      <NativeSelect
        id="filter-status"
        className="h-11 w-full"
        value={status}
        onChange={(event) => setStatus(event.target.value as CaseStatus | 'all')}
      >
        <NativeSelectOption value="all">{messages.filters.allStatuses}</NativeSelectOption>
        {(Object.keys(caseStatusLabels) as CaseStatus[]).map((value) => (
          <NativeSelectOption key={value} value={value}>
            {caseStatusLabels[value]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <AppShell
      view="operator"
      onOpenFilters={empty ? undefined : () => setFiltersOpen(true)}
      capabilities={capabilities}
    >
      <div className="grid gap-6">
        <section
          id="queue"
          className="scroll-mt-28 rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white"
        >
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.operator.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.operator.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {empty
              ? messages.emptyWorkspace.operatorBody
              : interpolate(messages.operator.intro, {
                  actor: currentTenant.operator,
                  tenant: currentTenant.name,
                })}
          </p>
        </section>

        {empty ? (
          <EmptyWorkspace view="operator" />
        ) : (
          <>
        <div className="hidden lg:block">{filters}</div>

        {queue.length === 0 ? (
          <EmptyFilterState
            title={messages.empty.queueTitle}
            description={messages.empty.queueBody}
          />
        ) : (
          <div className="grid gap-3">
            {queue.map((item) => (
              <article
                key={item.id}
                className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-medium">{item.subject}</h2>
                    <CaseStatusBadge status={item.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{item.lastNote}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {interpolate(messages.operator.slaLine, {
                      due: formatDateTime(item.slaDueAt, presentation),
                      count: formatNumber(item.evidenceCount, presentation),
                      assignee: item.assignee,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="h-11" render={<Link href={`/cases/${item.id}`} />}>
                    {messages.operator.openCase}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => notify(messages.operator.toastClaimTitle, item.id)}
                  >
                    {messages.operator.claim}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() =>
                      notify(
                        messages.operator.toastEvidenceTitle,
                        messages.operator.toastEvidenceBody,
                      )
                    }
                  >
                    {messages.operator.requestEvidence}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-11"
                    onClick={() =>
                      notify(
                        messages.operator.toastEscalateTitle,
                        messages.operator.toastEscalateBody,
                      )
                    }
                  >
                    {messages.operator.escalate}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11"
                    onClick={() =>
                      notify(
                        messages.operator.toastCompleteTitle,
                        messages.operator.toastCompleteBody,
                      )
                    }
                  >
                    {messages.operator.complete}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <section id="assigned" className="scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>{messages.operator.assignedTitle}</CardTitle>
              <CardDescription>
                {interpolate(messages.operator.assignedHint, {
                  actor: currentTenant.operator,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {assigned.map((item) => (
                <div
                  key={`assigned-${item.id}`}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{item.subject}</p>
                    <CaseStatusBadge status={item.status} />
                  </div>
                  <Button
                    variant="outline"
                    className="h-11"
                    render={<Link href={`/cases/${item.id}`} />}
                  >
                    {messages.operator.history}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section id="evidence" className="scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>{messages.operator.evidenceTitle}</CardTitle>
              <CardDescription>{messages.operator.evidenceHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {evidence.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="font-medium">{item.externalRef}</p>
                  <p className="text-sm text-muted-foreground">
                    {interpolate(messages.operator.reasons, {
                      reasons: item.reasons.join(', '),
                      policy: item.policyVersion,
                    })}
                  </p>
                  <p className="mt-1 text-sm">{item.recommendation}</p>
                  <Button
                    variant="ghost"
                    className="mt-3 h-11"
                    render={<Link href={`/evaluations/${item.id}`} />}
                  >
                    {messages.company.openEvaluation}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
          </>
        )}
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="p-4">
          <SheetHeader>
            <SheetTitle>{messages.filters.title}</SheetTitle>
            <SheetDescription>{messages.filters.operatorHint}</SheetDescription>
          </SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
