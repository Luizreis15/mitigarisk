'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppShell } from '@/components/prototype/app-shell';
import { EmptyFilterState } from '@/components/prototype/empty-filter-state';
import { PlatformBoundaryNotice } from '@/components/prototype/platform-boundary-notice';
import {
  PlatformGovernanceLoadingFallback,
  PlatformGovernanceStateView,
} from '@/components/prototype/platform-governance-state';
import {
  type TenantLifecycle,
  canGovernTenants,
  filterGovernedTenants,
  governanceDetailHref,
  governanceListHref,
  parseGovernanceQuery,
  platformAdminCapabilities,
  tenantLifecycles,
} from '@/lib/demo/platform-governance';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatNumber } from '@/lib/i18n/presentation';

export default function TenantDirectoryPage() {
  return (
    <Suspense fallback={<PlatformGovernanceLoadingFallback />}>
      <TenantDirectoryContent />
    </Suspense>
  );
}

function TenantDirectoryContent() {
  const router = useRouter();
  const params = useSearchParams();
  const query = useMemo(() => parseGovernanceQuery(params), [params]);
  const capabilities = platformAdminCapabilities();
  const rows = filterGovernedTenants(query);

  function replaceQuery(next: typeof query) {
    router.replace(governanceListHref(next), { scroll: false });
  }

  if (!canGovernTenants(capabilities) || query.workspace === 'denied') {
    return (
      <AppShell view="super-admin" capabilities={capabilities}>
        <PlatformGovernanceStateView
          state="denied"
          retryHref={governanceListHref()}
        />
      </AppShell>
    );
  }

  if (query.workspace !== 'ready' && query.workspace !== 'empty') {
    return (
      <AppShell view="super-admin" capabilities={capabilities}>
        <PlatformGovernanceStateView
          state={query.workspace}
          retryHref={governanceListHref({ q: query.q, lifecycle: query.lifecycle })}
        />
      </AppShell>
    );
  }

  return (
    <AppShell view="super-admin" capabilities={capabilities}>
      <div className="grid gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.platformGovernance.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.platformGovernance.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {messages.platformGovernance.intro}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href="/super-admin" />}
            >
              {messages.platformGovernance.backSuperAdmin}
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href="/company" />}
            >
              {messages.platformGovernance.openCompanyContext}
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href="/operator" />}
            >
              {messages.platformGovernance.openOperatorContext}
            </Button>
          </div>
        </section>

        <PlatformBoundaryNotice />

        {query.workspace === 'empty' ? (
          <PlatformGovernanceStateView state="empty" retryHref={governanceListHref()} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {messages.platformGovernance.filterHonesty}
            </p>
            <form
              className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_14rem_auto]"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="space-y-2">
                <Label htmlFor="gov-search">
                  {messages.platformGovernance.searchLabel}
                </Label>
                <Input
                  id="gov-search"
                  className="h-11"
                  value={query.q}
                  onChange={(event) =>
                    replaceQuery({
                      ...query,
                      q: event.target.value,
                      workspace: 'ready',
                    })
                  }
                  placeholder={messages.platformGovernance.searchPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gov-lifecycle">
                  {messages.platformGovernance.lifecycleLabel}
                </Label>
                <NativeSelect
                  id="gov-lifecycle"
                  className="h-11 w-full"
                  value={query.lifecycle}
                  onChange={(event) =>
                    replaceQuery({
                      ...query,
                      lifecycle: event.target.value as TenantLifecycle | 'all',
                      workspace: 'ready',
                    })
                  }
                >
                  <NativeSelectOption value="all">
                    {messages.platformGovernance.allLifecycles}
                  </NativeSelectOption>
                  {tenantLifecycles.map((lifecycle) => (
                    <NativeSelectOption key={lifecycle} value={lifecycle}>
                      {messages.platformGovernance.lifecycleValues[lifecycle]}
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
                    replaceQuery({ q: '', lifecycle: 'all', workspace: 'ready' })
                  }
                >
                  {messages.platformGovernance.clearFilters}
                </Button>
              </div>
            </form>

            <p className="text-sm text-muted-foreground">
              {interpolate(messages.platformGovernance.countLabel, {
                count: formatNumber(rows.length),
              })}
            </p>

            {rows.length === 0 ? (
              <EmptyFilterState
                title={messages.platformGovernance.emptyFiltersTitle}
                description={messages.platformGovernance.emptyFiltersBody}
              />
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{messages.platformGovernance.tenant}</TableHead>
                        <TableHead>{messages.platformGovernance.lifecycle}</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          {messages.platformGovernance.memberships}
                        </TableHead>
                        <TableHead className="hidden xl:table-cell">
                          {messages.platformGovernance.policyPosture}
                        </TableHead>
                        <TableHead className="text-right">
                          {messages.platformGovernance.open}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <div className="grid gap-1">
                              <span className="font-medium">{tenant.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {tenant.id}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {messages.platformGovernance.lifecycleValues[tenant.lifecycle]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {tenant.membershipActive}/{tenant.membershipInvited}/
                            {tenant.membershipSuspended}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm">
                            {
                              messages.platformGovernance.policyValues[
                                tenant.policyPosture
                              ]
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              className="h-11"
                              render={<Link href={governanceDetailHref(tenant.id)} />}
                            >
                              {messages.platformGovernance.open}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {rows.map((tenant) => (
                    <article
                      key={tenant.id}
                      className="space-y-3 rounded-xl border bg-card p-4"
                    >
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.id}</p>
                      <Badge variant="outline">
                        {messages.platformGovernance.lifecycleValues[tenant.lifecycle]}
                      </Badge>
                      <Button
                        className="h-11 w-full"
                        render={<Link href={governanceDetailHref(tenant.id)} />}
                      >
                        {messages.platformGovernance.open}
                      </Button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
