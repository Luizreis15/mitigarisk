'use client';

import { useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TriangleAlertIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { HealthStatus } from '@/components/prototype/status-badge';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import { demoAuditEvents, demoTenants, presentation } from '@/lib/demo/data';
import { healthLabels } from '@/lib/demo/labels';
import type { TenantHealth } from '@/lib/demo/types';
import { interpolate, messages } from '@/lib/i18n/messages';
import { memberships } from '@/lib/demo/session';
import {
  formatCurrencyFromMinorUnits,
  formatDateTime,
  formatNumber,
} from '@/lib/i18n/presentation';

export default function SuperAdminPage() {
  return (
    <Suspense>
      <SuperAdminContent />
    </Suspense>
  );
}

function SuperAdminContent() {
  const notify = usePrototypeFeedback();
  const params = useSearchParams();
  const empty = params.get('state') === 'empty';
  const capabilities = memberships.find((item) => item.id === 'mem_platform')
    ?.capabilities;
  const [health, setHealth] = useState<TenantHealth | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const tenants = useMemo(
    () => demoTenants.filter((item) => health === 'all' || item.health === health),
    [health],
  );

  const filters = (
    <div className="space-y-3">
      <Label htmlFor="filter-health">{messages.filters.tenantHealth}</Label>
      <NativeSelect
        id="filter-health"
        className="h-11 w-full"
        value={health}
        onChange={(event) =>
          setHealth(event.target.value as TenantHealth | 'all')
        }
      >
        <NativeSelectOption value="all">{messages.filters.allHealth}</NativeSelectOption>
        <NativeSelectOption value="healthy">{messages.status.health.healthy}</NativeSelectOption>
        <NativeSelectOption value="degraded">{messages.status.health.degraded}</NativeSelectOption>
        <NativeSelectOption value="incident">{messages.status.health.incident}</NativeSelectOption>
      </NativeSelect>
    </div>
  );

  return (
    <AppShell
      view="super-admin"
      onOpenFilters={empty ? undefined : () => setFiltersOpen(true)}
      capabilities={capabilities}
    >
      <div className="grid gap-6">
        <section
          id="tenants"
          className="scroll-mt-28 rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white"
        >
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.admin.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.admin.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {empty ? messages.emptyWorkspace.adminBody : messages.admin.intro}
          </p>
        </section>

        {empty ? (
          <EmptyWorkspace view="super-admin" />
        ) : (
          <>
        <Alert className="border-[#ead9b8] bg-[#f4ead8]">
          <TriangleAlertIcon />
          <AlertTitle>{messages.admin.destructiveTitle}</AlertTitle>
          <AlertDescription>{messages.admin.destructiveBody}</AlertDescription>
        </Alert>

        <div className="hidden lg:block">{filters}</div>

        {tenants.length === 0 ? (
          <EmptyFilterState
            title={messages.empty.tenantsTitle}
            description={messages.empty.tenantsBody}
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{messages.admin.tenant}</TableHead>
                    <TableHead>{messages.admin.plan}</TableHead>
                    <TableHead>{messages.admin.health}</TableHead>
                    <TableHead>{messages.admin.evaluationsToday}</TableHead>
                    <TableHead>{messages.admin.webhooks}</TableHead>
                    <TableHead className="text-right">{messages.admin.action}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>{tenant.plan}</TableCell>
                      <TableCell>
                        <HealthStatus health={tenant.health} />
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatNumber(tenant.evaluationsToday, presentation)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {interpolate(messages.admin.webhookFailures, {
                          count: formatNumber(tenant.webhookFailures, presentation),
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          className="h-11"
                          onClick={() =>
                            notify(
                              messages.admin.toastInvestigateTitle,
                              interpolate(messages.admin.toastInvestigateBody, {
                                name: tenant.name,
                              }),
                            )
                          }
                        >
                          {messages.admin.investigate}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 md:hidden">
              {tenants.map((tenant) => (
                <article key={tenant.id} className="space-y-3 rounded-xl border bg-card p-4">
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {interpolate(messages.admin.planLine, {
                      plan: tenant.plan,
                      health: healthLabels[tenant.health],
                    })}
                  </p>
                  <HealthStatus health={tenant.health} />
                  <Button
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() =>
                      notify(messages.admin.toastPlanTitle, messages.admin.toastPlanBody)
                    }
                  >
                    {messages.admin.adjustPlan}
                  </Button>
                </article>
              ))}
            </div>
          </>
        )}

        <section id="health" className="scroll-mt-28 grid gap-4 md:grid-cols-3">
          {demoTenants.map((tenant) => (
            <Card key={`${tenant.id}-health`}>
              <CardHeader>
                <CardTitle className="text-base">{tenant.name}</CardTitle>
                <CardDescription>{messages.admin.franchiseUsage}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScoreMeter
                  label={messages.admin.usage}
                  score={tenant.consumptionPct}
                  band={
                    tenant.consumptionPct >= 80
                      ? 'high'
                      : tenant.consumptionPct >= 50
                        ? 'medium'
                        : 'low'
                  }
                />
                <p className="text-sm text-muted-foreground">
                  {interpolate(messages.admin.billed, {
                    amount: formatCurrencyFromMinorUnits(
                      tenant.billedMinorUnits,
                      presentation,
                    ),
                  })}
                </p>
                <Button
                  variant="secondary"
                  className="h-11 w-full"
                  onClick={() =>
                    notify(messages.admin.toastSuspendTitle, messages.admin.toastSuspendBody)
                  }
                >
                  {messages.admin.suspend}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="audit" className="scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>{messages.admin.recentAudit}</CardTitle>
              <CardDescription>{messages.admin.auditHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoAuditEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <p className="font-mono text-sm">{event.action}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.actor} · {event.target} ·{' '}
                    {formatDateTime(event.at, presentation)} · {event.correlationId}
                  </p>
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
            <SheetDescription>{messages.filters.adminHint}</SheetDescription>
          </SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
