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
import { AppShell } from '@/components/prototype/app-shell';
import { EmptyFilterState } from '@/components/prototype/empty-filter-state';
import { CaseStatusBadge } from '@/components/prototype/status-badge';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import { currentTenant, demoCases, demoEvaluations } from '@/lib/demo/data';
import { caseStatusLabels, formatDateTime } from '@/lib/demo/labels';
import type { CaseStatus } from '@/lib/demo/types';

export default function OperadorPage() {
  const notify = usePrototypeFeedback();
  const [status, setStatus] = useState<CaseStatus | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const queue = useMemo(
    () => demoCases.filter((item) => status === 'all' || item.status === status),
    [status],
  );
  const assigned = demoCases.filter((item) => item.assignee === 'Camila Ribeiro');
  const evidence = demoEvaluations.filter((item) => item.quality !== 'complete');

  const filters = (
    <div className="space-y-3">
      <Label htmlFor="filtro-status">Status da fila</Label>
      <NativeSelect
        id="filtro-status"
        className="h-11 w-full"
        value={status}
        onChange={(event) => setStatus(event.target.value as CaseStatus | 'all')}
      >
        <NativeSelectOption value="all">Todos os status</NativeSelectOption>
        {(Object.keys(caseStatusLabels) as CaseStatus[]).map((value) => (
          <NativeSelectOption key={value} value={value}>
            {caseStatusLabels[value]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <AppShell view="operador" onOpenFilters={() => setFiltersOpen(true)}>
      <div className="grid gap-6">
        <section
          id="queue"
          className="scroll-mt-28 rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white"
        >
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            Fila operacional
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">Operador</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            Processar SLA, evidências e encaminhamento. Sessão de demonstração
            como Camila Ribeiro em {currentTenant.name}. Sem alteração de política.
          </p>
        </section>

        <div className="hidden lg:block">{filters}</div>

        {queue.length === 0 ? (
          <EmptyFilterState
            title="Fila vazia neste status"
            description="Escolha outro status para ver casos fictícios com SLA."
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
                    SLA até {formatDateTime(item.slaDueAt)} · {item.evidenceCount}{' '}
                    evidências · {item.assignee}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="h-11"
                    onClick={() =>
                      notify('Caso assumido na demonstração', item.id)
                    }
                  >
                    Assumir
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() =>
                      notify(
                        'Evidência solicitada localmente',
                        'Nenhuma mensagem foi enviada.',
                      )
                    }
                  >
                    Solicitar evidência
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-11"
                    onClick={() =>
                      notify('Escalado na demonstração', 'Analista fictício notificado.')
                    }
                  >
                    Escalar
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11"
                    onClick={() =>
                      notify('Conclusão simulada', 'Nenhum caso real foi encerrado.')
                    }
                  >
                    Concluir
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <section id="assigned" className="scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>Casos atribuídos</CardTitle>
              <CardDescription>
                Itens com responsável Camila Ribeiro nesta demonstração.
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
                    onClick={() => notify('Histórico local', item.lastNote)}
                  >
                    Ver histórico
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section id="evidence" className="scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>Pendências de evidência</CardTitle>
              <CardDescription>
                Qualidade insuficiente permanece distinta do score de risco.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {evidence.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="font-medium">{item.externalRef}</p>
                  <p className="text-sm text-muted-foreground">
                    Motivos: {item.reasons.join(', ')} · política {item.policyVersion}
                  </p>
                  <p className="mt-1 text-sm">{item.recommendation}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="p-4">
          <SheetHeader>
            <SheetTitle>Filtros da fila</SheetTitle>
            <SheetDescription>Os filtros não consultam nenhum backend.</SheetDescription>
          </SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
