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
import { PolicyLifecycleStatus } from '@/components/prototype/status-badge';
import { policyLifecycleLabels } from '@/lib/demo/labels';
import { memberships } from '@/lib/demo/session';
import { demoPolicies } from '@/lib/demo/policies';
import type { PolicyLifecycle } from '@/lib/demo/types';
import {
  filterPolicies,
  parsePolicyQuery,
  policyDetailHref,
  policyLifecycles,
  policyListHref,
} from '@/lib/demo/policy-workbench';
import { presentation } from '@/lib/demo/data';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime, formatNumber } from '@/lib/i18n/presentation';

export default function PoliciesPage() {
  return (
    <Suspense>
      <PoliciesContent />
    </Suspense>
  );
}

function PoliciesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const query = useMemo(() => parsePolicyQuery(params), [params]);
  const capabilities = memberships.find((item) => item.id === 'mem_helix_company')
    ?.capabilities;
  const filtered = filterPolicies(query);

  function replaceQuery(next: typeof query) {
    router.replace(policyListHref(next), { scroll: false });
  }

  return (
    <AppShell view="company" capabilities={capabilities}>
      <div className="grid gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.policy.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.policy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {messages.policy.intro}
          </p>
        </section>

        <RecommendationNotice />

        <p className="text-sm text-muted-foreground">{messages.policy.filterHonesty}</p>

        <form
          className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_14rem_auto]"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="space-y-2">
            <Label htmlFor="policy-search">{messages.policy.searchLabel}</Label>
            <Input
              id="policy-search"
              className="h-11"
              value={query.q}
              onChange={(event) =>
                replaceQuery({ ...query, q: event.target.value, empty: false })
              }
              placeholder={messages.policy.searchPlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-lifecycle">{messages.policy.lifecycleLabel}</Label>
            <NativeSelect
              id="policy-lifecycle"
              className="h-11 w-full"
              value={query.lifecycle}
              onChange={(event) =>
                replaceQuery({
                  ...query,
                  lifecycle: event.target.value as PolicyLifecycle | 'all',
                  empty: false,
                })
              }
            >
              <NativeSelectOption value="all">
                {messages.policy.allLifecycles}
              </NativeSelectOption>
              {policyLifecycles.map((lifecycle) => (
                <NativeSelectOption key={lifecycle} value={lifecycle}>
                  {policyLifecycleLabels[lifecycle]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() =>
                replaceQuery({ q: '', lifecycle: 'all', empty: false })
              }
            >
              {messages.policy.clearFilters}
            </Button>
          </div>
        </form>

        <p className="text-sm text-muted-foreground">
          {interpolate(messages.policy.countLabel, {
            count: formatNumber(filtered.length, presentation),
          })}
        </p>

        {query.empty || demoPolicies.length === 0 ? (
          <EmptyFilterState
            title={messages.policy.emptyTitle}
            description={messages.policy.emptyBody}
          />
        ) : filtered.length === 0 ? (
          <EmptyFilterState
            title={messages.policy.noResultsTitle}
            description={messages.policy.noResultsBody}
          />
        ) : (
          <div className="grid gap-3">
            {filtered.map((item) => (
              <article key={item.id} className="grid gap-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-base font-medium">{item.id}</h2>
                  <PolicyLifecycleStatus lifecycle={item.lifecycle} />
                </div>
                <p className="text-sm">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {messages.policy.version} {item.versionNumber} · {item.owner} ·{' '}
                  {formatDateTime(item.lastActivityAt, presentation)}
                </p>
                <Button
                  className="h-11 w-fit"
                  render={<Link href={policyDetailHref(item.id, query)} />}
                >
                  {messages.policy.openPolicy}
                </Button>
              </article>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          className="h-11 w-fit"
          render={
            <Link
              href={policyListHref({ q: '', lifecycle: 'all', empty: true })}
            />
          }
        >
          {messages.policy.emptyLink}
        </Button>
      </div>
    </AppShell>
  );
}
