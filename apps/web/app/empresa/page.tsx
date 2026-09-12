'use client';

import { useMemo, useState } from 'react';

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
} from '@/lib/demo/data';
import { formatDateTime, riskBandLabels } from '@/lib/demo/labels';
import type { RiskBand } from '@/lib/demo/types';

export default function EmpresaPage() {
  const notify = usePrototypeFeedback();
  const [band, setBand] = useState<RiskBand | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = useMemo(
    () =>
      demoEvaluations.filter((item) => band === 'all' || item.band === band),
    [band],
  );

  const filters = (
    <div className="space-y-3">
      <Label htmlFor="filtro-faixa">Faixa de risco</Label>
      <NativeSelect
        id="filtro-faixa"
        className="h-11 w-full"
        value={band}
        onChange={(event) => setBand(event.target.value as RiskBand | 'all')}
      >
        <NativeSelectOption value="all">Todas as faixas</NativeSelectOption>
        <NativeSelectOption value="low">Baixo</NativeSelectOption>
        <NativeSelectOption value="medium">Médio</NativeSelectOption>
        <NativeSelectOption value="high">Alto</NativeSelectOption>
      </NativeSelect>
    </div>
  );

  return (
    <AppShell view="empresa" onOpenFilters={() => setFiltersOpen(true)}>
      <div className="grid gap-6">
        <section
          id="overview"
          className="scroll-mt-28 rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white shadow-[var(--shadow-sm)]"
        >
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            Exposição consolidada
          </p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)]">
            <div>
              <h1 className="text-[2rem] leading-[1.2] font-semibold">
                {currentTenant.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                Score consolidado 64/100 na política {currentTenant.policyVersion}.
                A decisão final permanece com a contratante. Ator da sessão de
                demonstração: {currentTenant.actor}.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="h-11 bg-white text-[#203442] hover:bg-white/90"
                  onClick={() =>
                    notify(
                      'Avaliação simulada',
                      'Nenhum cálculo real foi disparado neste protótipo.',
                    )
                  }
                >
                  Criar avaliação
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
                  onClick={() =>
                    notify(
                      'Exportação simulada',
                      'Nenhum arquivo ou dado de cliente foi gerado.',
                    )
                  }
                >
                  Exportar resumo
                </Button>
              </div>
            </div>
            <div className="space-y-4 rounded-xl bg-white/10 p-4">
              {demoDimensions.map((dimension) => (
                <ScoreMeter
                  key={dimension.code}
                  label={dimension.label}
                  score={dimension.score}
                  band={dimension.band}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="hidden lg:block">{filters}</div>

        <section id="evaluations" className="scroll-mt-28 space-y-3">
          <div>
            <h2 className="text-[1.375rem] leading-[1.3] font-semibold">Avaliações</h2>
            <p className="text-sm text-muted-foreground">
              Motivos, qualidade e versão de política visíveis em cada linha.
            </p>
          </div>
          {filtered.length === 0 ? (
            <EmptyFilterState
              title="Nenhuma avaliação nesta faixa"
              description="Ajuste o filtro de risco para voltar aos registros fictícios."
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referência</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Política</TableHead>
                      <TableHead>Quando</TableHead>
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
                          {item.score}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            <RiskStatus band={item.band} />
                            <QualityStatus quality={item.quality} />
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.policyVersion}
                        </TableCell>
                        <TableCell>{formatDateTime(item.evaluatedAt)}</TableCell>
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
                      Score {item.score} · {riskBandLabels[item.band]}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <RiskStatus band={item.band} />
                      <QualityStatus quality={item.quality} />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {item.policyVersion} · {formatDateTime(item.evaluatedAt)}
                    </p>
                    <p className="mt-2 text-sm">{item.recommendation}</p>
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
                  {alert.subject} · SLA restante {alert.slaMinutes} min
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() =>
                    notify('Alerta revisado localmente', `${alert.id} permanece fictício.`)
                  }
                >
                  Revisar alerta
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="cases" className="scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>Casos em aberto</CardTitle>
              <CardDescription>
                {demoCases.filter((item) => item.status !== 'closed').length} itens
                na operação da Arena Lúdica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoCases
                .filter((item) => item.status !== 'closed')
                .map((item) => (
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
                      onClick={() =>
                        notify('Caso aberto na demonstração', item.id)
                      }
                    >
                      Abrir
                    </Button>
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
            <SheetDescription>
              Aplicam-se apenas aos dados fictícios desta tela.
            </SheetDescription>
          </SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
