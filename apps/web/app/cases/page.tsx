'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { AppShell } from '@/components/prototype/app-shell';
import { EmptyFilterState } from '@/components/prototype/empty-filter-state';
import { RecommendationNotice } from '@/components/prototype/recommendation-notice';
import { WorkbenchCaseCard } from '@/components/prototype/workbench-case-card';
import { caseStatusLabels, workbenchViewLabels } from '@/lib/demo/labels';
import { memberships } from '@/lib/demo/session';
import type { CaseStatus, RiskBand } from '@/lib/demo/types';
import {
  casesInView,
  filterWorkbenchCases,
  parseWorkbenchQuery,
  workbenchHref,
  workbenchViews,
} from '@/lib/demo/workbench';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatNumber } from '@/lib/i18n/presentation';
import { presentation } from '@/lib/demo/data';

export default function CasesWorkbenchPage() {
  return (
    <Suspense>
      <WorkbenchContent />
    </Suspense>
  );
}

function WorkbenchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const query = useMemo(() => parseWorkbenchQuery(params), [params]);
  const capabilities = memberships.find((item) => item.id === 'mem_helix_operator')
    ?.capabilities;
  const inView = casesInView(query.view);
  const filtered = filterWorkbenchCases(query);

  function replaceQuery(next: typeof query) {
    router.replace(workbenchHref(next), { scroll: false });
  }

  return (
    <AppShell view="operator" capabilities={capabilities}>
      <div className="grid gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.workbench.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.workbench.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {messages.workbench.intro}
          </p>
        </section>

        <RecommendationNotice />

        <p className="text-sm text-muted-foreground">{messages.workbench.filterHonesty}</p>

        <div className="grid gap-3">
          <p id="queue-views-label" className="text-sm font-medium">
            {messages.workbench.viewsLabel}
          </p>
          <div
            role="tablist"
            aria-labelledby="queue-views-label"
            className="flex flex-wrap gap-2"
          >
            {workbenchViews.map((view) => (
              <Button
                key={view}
                type="button"
                variant={query.view === view ? 'default' : 'outline'}
                className="h-11"
                aria-current={query.view === view ? 'page' : undefined}
                render={<Link href={workbenchHref({ ...query, view, empty: false })} />}
              >
                {workbenchViewLabels[view]}
              </Button>
            ))}
          </div>
        </div>

        <form
          className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="workbench-search">{messages.workbench.searchLabel}</Label>
            <Input
              id="workbench-search"
              className="h-11"
              value={query.q}
              onChange={(event) =>
                replaceQuery({ ...query, q: event.target.value, empty: false })
              }
              placeholder={messages.workbench.searchPlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workbench-band">{messages.workbench.bandLabel}</Label>
            <NativeSelect
              id="workbench-band"
              className="h-11 w-full"
              value={query.band}
              onChange={(event) =>
                replaceQuery({
                  ...query,
                  band: event.target.value as RiskBand | 'all',
                  empty: false,
                })
              }
            >
              <NativeSelectOption value="all">{messages.workbench.allBands}</NativeSelectOption>
              <NativeSelectOption value="low">{messages.status.risk.low}</NativeSelectOption>
              <NativeSelectOption value="medium">{messages.status.risk.medium}</NativeSelectOption>
              <NativeSelectOption value="high">{messages.status.risk.high}</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workbench-status">{messages.workbench.statusLabel}</Label>
            <NativeSelect
              id="workbench-status"
              className="h-11 w-full"
              value={query.status}
              onChange={(event) =>
                replaceQuery({
                  ...query,
                  status: event.target.value as CaseStatus | 'all',
                  empty: false,
                })
              }
            >
              <NativeSelectOption value="all">
                {messages.workbench.allStatuses}
              </NativeSelectOption>
              {(Object.keys(caseStatusLabels) as CaseStatus[]).map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {caseStatusLabels[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() =>
                replaceQuery({
                  view: query.view,
                  q: '',
                  band: 'all',
                  status: 'all',
                  empty: false,
                })
              }
            >
              {messages.workbench.clearFilters}
            </Button>
          </div>
        </form>

        <p className="text-sm text-muted-foreground">
          {interpolate(messages.workbench.countLabel, {
            count: formatNumber(filtered.length, presentation),
          })}
        </p>

        {query.empty || inView.length === 0 ? (
          <EmptyFilterState
            title={messages.workbench.emptyTitle}
            description={messages.workbench.emptyBody}
          />
        ) : filtered.length === 0 ? (
          <EmptyFilterState
            title={messages.workbench.noResultsTitle}
            description={messages.workbench.noResultsBody}
          />
        ) : (
          <div className="grid gap-3">
            {filtered.map((item) => (
              <WorkbenchCaseCard key={item.id} item={item} query={query} />
            ))}
          </div>
        )}

        <Button
          variant="outline"
          className="h-11 w-fit"
          render={<Link href={workbenchHref({ ...query, empty: true, q: '', band: 'all', status: 'all' })} />}
        >
          {messages.workbench.emptyQueueLink}
        </Button>
      </div>
    </AppShell>
  );
}
