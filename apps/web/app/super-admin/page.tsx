'use client';

import { useMemo, useState } from 'react';

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
import { ScoreMeter } from '@/components/prototype/score-meter';
import { HealthStatus } from '@/components/prototype/status-badge';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import { demoAuditEvents, demoTenants } from '@/lib/demo/data';
import { formatDateTime, healthLabels } from '@/lib/demo/labels';
import type { TenantHealth } from '@/lib/demo/types';
import { TriangleAlertIcon } from 'lucide-react';

export default function SuperAdminPage() {
  const notify = usePrototypeFeedback();
  const [health, setHealth] = useState<TenantHealth | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const tenants = useMemo(
    () => demoTenants.filter((item) => health === 'all' || item.health === health),
    [health],
  );

  const filters = (
    <div className="space-y-3">
      <Label htmlFor="filtro-saude">Saúde do tenant</Label>
      <NativeSelect
        id="filtro-saude"
        className="h-11 w-full"
        value={health}
        onChange={(event) =>
          setHealth(event.target.value as TenantHealth | 'all')
        }
      >
        <NativeSelectOption value="all">Todos os estados</NativeSelectOption>
        <NativeSelectOption value="healthy">Saudável</NativeSelectOption>
        <NativeSelectOption value="degraded">Degradado</NativeSelectOption>
        <NativeSelectOption value="incident">Incidente</NativeSelectOption>
      </NativeSelect>
    </div>
  );

  return (
    <AppShell view="super-admin" onOpenFilters={() => setFiltersOpen(true)}>
      <div className="grid gap-6">
        <section
          id="tenants"
          className="scroll-mt-28 rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white"
        >
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            Governança da plataforma
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            Super admin
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            Metadados operacionais de tenants fictícios. Esta visão não acessa
            dados cadastrais sensíveis por padrão.
          </p>
        </section>

        <Alert className="border-[#ead9b8] bg-[#f4ead8]">
          <TriangleAlertIcon />
          <AlertTitle>Ações destrutivas são simuladas</AlertTitle>
          <AlertDescription>
            Suspender tenant, ajustar plano ou investigar evento apenas exibe
            feedback local. Não há efeito em infraestrutura.
          </AlertDescription>
        </Alert>

        <div className="hidden lg:block">{filters}</div>

        {tenants.length === 0 ? (
          <EmptyFilterState
            title="Nenhum tenant neste estado"
            description="Limpe o filtro de saúde para ver a carteira de demonstração."
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Saúde</TableHead>
                    <TableHead>Avaliações hoje</TableHead>
                    <TableHead>Webhooks</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
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
                        {tenant.evaluationsToday}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {tenant.webhookFailures} falhas
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          className="h-11"
                          onClick={() =>
                            notify(
                              'Investigação simulada',
                              `${tenant.name} permanece em dados fictícios.`,
                            )
                          }
                        >
                          Investigar
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
                    Plano {tenant.plan} · {healthLabels[tenant.health]}
                  </p>
                  <HealthStatus health={tenant.health} />
                  <Button
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() =>
                      notify('Plano não alterado', 'Ajuste de plano é só feedback local.')
                    }
                  >
                    Ajustar plano
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
                <CardDescription>Consumo da franquia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScoreMeter
                  label="Consumo"
                  score={tenant.consumptionPct}
                  band={
                    tenant.consumptionPct >= 80
                      ? 'high'
                      : tenant.consumptionPct >= 50
                        ? 'medium'
                        : 'low'
                  }
                />
                <Button
                  variant="secondary"
                  className="h-11 w-full"
                  onClick={() =>
                    notify(
                      'Suspensão não executada',
                      'O protótipo não altera estado de tenant.',
                    )
                  }
                >
                  Suspender tenant
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="audit" className="scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>Auditoria recente</CardTitle>
              <CardDescription>
                Evidência imutável de demonstração: ator, alvo, horário e correlação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoAuditEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <p className="font-mono text-sm">{event.action}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.actor} · {event.target} · {formatDateTime(event.at)} ·{' '}
                    {event.correlationId}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="p-4">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Apenas metadados fictícios de tenants.</SheetDescription>
          </SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
