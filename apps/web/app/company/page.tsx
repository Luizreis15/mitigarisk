'use client';

import { Suspense, useMemo, useState } from 'react';
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
import { EmptyWorkspace } from '@/components/prototype/empty-workspace';
import { ScoreMeter } from '@/components/prototype/score-meter';
import {
  QualityStatus,
  RiskStatus,
  SeverityStatus,
} from '@/components/prototype/status-badge';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import {
  currentTenant,
  demoAlerts,
  demoCases,
  demoDimensions,
  demoEvaluations,
  presentation,
} from '@/lib/demo/data';
import { riskBandLabels } from '@/lib/demo/labels';
import type { RiskBand } from '@/lib/demo/types';
import { memberships } from '@/lib/demo/session';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime, formatNumber, formatScore } from '@/lib/i18n/presentation';
import { caseHrefFromQueue } from '@/lib/demo/workbench';
import { canManageCompanyMembers } from '@/lib/demo/company-admin';
import type { Capability } from '@/lib/demo/types';

export default function CompanyPage() {
  return (
    <Suspense>
      <CompanyContent />
    </Suspense>
  );
}

function CompanyContent() {
  const notify = usePrototypeFeedback();
  const params = useSearchParams();
  const empty = params.get('state') === 'empty';
  const capabilities = Array.from(
    new Set(
      memberships
        .filter(
          (item) =>
            item.id === 'mem_helix_company' || item.id === 'mem_northstar_admin',
        )
        .flatMap((item) => item.capabilities),
    ),
  ) as Capability[];
  const [band, setBand] = useState<RiskBand | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = useMemo(
    () => demoEvaluations.filter((item) => band === 'all' || item.band === band),
    [band],
  );
  const openCases = demoCases.filter((item) => item.status !== 'closed');

  const filters = (
    <div className="space-y-3">
      <Label htmlFor="filter-band">{messages.filters.riskBand}</Label>
      <NativeSelect
        id="filter-band"
        className="h-11 w-full"
        value={band}
        onChange={(event) => setBand(event.target.value as RiskBand | 'all')}
      >
        <NativeSelectOption value="all">{messages.filters.allBands}</NativeSelectOption>
        <NativeSelectOption value="low">{messages.status.risk.low}</NativeSelectOption>
        <NativeSelectOption value="medium">{messages.status.risk.medium}</NativeSelectOption>
        <NativeSelectOption value="high">{messages.status.risk.high}</NativeSelectOption>
      </NativeSelect>
    </div>
  );

  return (
    <AppShell
      view="company"
      onOpenFilters={empty ? undefined : () => setFiltersOpen(true)}
      capabilities={capabilities}
    >
      <div className="grid gap-6">
        <section
          id="overview"
          className="scroll-mt-28 rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white shadow-[var(--shadow-sm)]"
        >
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.company.kicker}
          </p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)]">
            <div>
              <h1 className="text-[2rem] leading-[1.2] font-semibold">
                {currentTenant.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                {empty
                  ? messages.emptyWorkspace.companyBody
                  : interpolate(messages.company.summary, {
                      score: formatScore(64),
                      policy: currentTenant.policyVersion,
                      actor: currentTenant.actor,
                    })}
              </p>
              {empty ? null : (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    className="h-11 bg-white text-[#203442] hover:bg-white/90"
                    render={<Link href="/evaluations/new" />}
                  >
                    {messages.company.createEvaluation}
                  </Button>
                  {capabilities?.includes('policy.view') ? (
                    <Button
                      variant="outline"
                      className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
                      render={<Link href="/policies" />}
                    >
                      {messages.policy.openFromCompany}
                    </Button>
                  ) : null}
                  {canManageCompanyMembers(capabilities) ? (
                    <Button
                      variant="outline"
                      className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
                      render={<Link href="/company/admin" />}
                    >
                      {messages.company.openAdministration}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
                    onClick={() =>
                      notify(
                        messages.company.toastExportTitle,
                        messages.company.toastExportBody,
                      )
                    }
                  >
                    {messages.company.exportSummary}
                  </Button>
                </div>
              )}
            </div>
            {empty ? null : (
            <div className="space-y-4 rounded-xl bg-white/10 p-4">
              {demoDimensions.map((dimension) => (
                <ScoreMeter
                  key={dimension.code}
                  label={messages.company.dimensions[dimension.code]}
                  score={dimension.score}
                  band={dimension.band}
                />
              ))}
            </div>
            )}
          </div>
        </section>

        {empty ? (
          <EmptyWorkspace view="company" />
        ) : (
          <>
        <div className="hidden lg:block">{filters}</div>

        <section id="evaluations" className="scroll-mt-28 space-y-3">
          <div>
            <h2 className="text-[1.375rem] leading-[1.3] font-semibold">
              {messages.company.evaluationsTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {messages.company.evaluationsHint}
            </p>
          </div>
          {filtered.length === 0 ? (
            <EmptyFilterState
              title={messages.empty.evaluationsTitle}
              description={messages.empty.evaluationsBody}
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{messages.company.reference}</TableHead>
                      <TableHead>{messages.company.score}</TableHead>
                      <TableHead>{messages.company.status}</TableHead>
                      <TableHead>{messages.company.policy}</TableHead>
                      <TableHead>{messages.company.when}</TableHead>
                      <TableHead>{messages.company.open}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">{item.externalRef}</p>
                          <p className="text-xs text-muted-foreground">{item.subject}</p>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {formatNumber(item.score, presentation)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            <RiskStatus band={item.band} />
                            <QualityStatus quality={item.quality} />
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link
                            className="underline-offset-4 hover:underline"
                            href={`/policies/${item.policyVersion}`}
                          >
                            {item.policyVersion}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {formatDateTime(item.evaluatedAt, presentation)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            className="h-11"
                            render={<Link href={`/evaluations/${item.id}`} />}
                          >
                            {messages.company.openEvaluation}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {filtered.map((item) => (
                  <article key={item.id} className="rounded-xl border bg-card p-4">
                    <p className="font-medium">{item.externalRef}</p>
                    <p className="text-sm text-muted-foreground">{item.subject}</p>
                    <p className="mt-2 font-mono text-sm">
                      {messages.company.score} {formatNumber(item.score, presentation)} ·{' '}
                      {riskBandLabels[item.band]}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <RiskStatus band={item.band} />
                      <QualityStatus quality={item.quality} />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      <Link
                        className="underline-offset-4 hover:underline"
                        href={`/policies/${item.policyVersion}`}
                      >
                        {item.policyVersion}
                      </Link>
                      {' · '}
                      {formatDateTime(item.evaluatedAt, presentation)}
                    </p>
                    <p className="mt-2 text-sm">{item.recommendation}</p>
                    <Button
                      variant="outline"
                      className="mt-3 h-11"
                      render={<Link href={`/evaluations/${item.id}`} />}
                    >
                      {messages.company.openEvaluation}
                    </Button>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section id="alerts" className="scroll-mt-28 grid gap-3 md:grid-cols-3">
          {demoAlerts.map((alert) => (
            <Card key={alert.id}>
              <CardHeader>
                <SeverityStatus severity={alert.severity} />
                <CardTitle className="text-base">{alert.title}</CardTitle>
                <CardDescription>
                  {interpolate(messages.company.slaRemaining, {
                    subject: alert.subject,
                    minutes: formatNumber(alert.slaMinutes, presentation),
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() =>
                    notify(
                      messages.company.toastAlertTitle,
                      interpolate(messages.company.toastAlertBody, { id: alert.id }),
                    )
                  }
                >
                  {messages.company.reviewAlert}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="cases" className="scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>{messages.company.openCases}</CardTitle>
              <CardDescription>
                {interpolate(messages.company.openCasesHint, {
                  count: formatNumber(openCases.length, presentation),
                  tenant: currentTenant.name,
                })}
              </CardDescription>
              <Button
                variant="outline"
                className="h-11 w-fit"
                render={<Link href="/cases" />}
              >
                {messages.operator.openWorkbench}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {openCases.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{item.subject}</p>
                    <p className="text-sm text-muted-foreground">{item.lastNote}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="h-11"
                    render={<Link href={caseHrefFromQueue(item)} />}
                  >
                    {messages.company.open}
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
            <SheetDescription>{messages.filters.companyHint}</SheetDescription>
          </SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
