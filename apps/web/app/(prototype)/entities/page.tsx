'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppShell } from '@/components/prototype/app-shell';
import { ConceptSeparationNotice } from '@/components/prototype/concept-separation-notice';
import {
  EntityIntakeLoadingFallback,
  EntityIntakeStateView,
} from '@/components/prototype/entity-intake-state';
import { QualityStatus } from '@/components/prototype/status-badge';
import {
  canStartEvaluation,
  companyEvaluateCapabilities,
  entityHref,
  evaluationIntakeHref,
  intakeTenant,
  northstarEntities,
  parseIntakeState,
} from '@/lib/demo/entity-intake';
import { interpolate, messages } from '@/lib/i18n/messages';
import { presentation } from '@/lib/demo/data';
import { formatDateTime } from '@/lib/i18n/presentation';

export default function EntitiesPage() {
  return (
    <Suspense fallback={<EntityIntakeLoadingFallback />}>
      <EntitiesContent />
    </Suspense>
  );
}

function EntitiesContent() {
  const params = useSearchParams();
  const state = parseIntakeState(params.get('state'));
  const capabilities = companyEvaluateCapabilities();

  return (
    <AppShell
      view="company"
      capabilities={capabilities}
      workspace={{
        name: intakeTenant.name,
        environment: intakeTenant.environment,
        policyVersion: intakeTenant.policyVersion,
      }}
    >
      <div className="grid gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white shadow-[var(--shadow-sm)]">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.entityIntake.kicker}
          </p>
          <h1 className="mt-3 text-[2rem] leading-[1.2] font-semibold">
            {messages.entityIntake.listTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {messages.entityIntake.listIntro}
          </p>
          <p className="mt-3 text-xs text-white/70">
            {interpolate(messages.presentation.summary, {
              timeZone: presentation.timeZone,
              currency: presentation.currency,
              locale: presentation.locale,
            })}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {canStartEvaluation(capabilities) ? (
              <Button
                className="h-11 bg-white text-[#203442] hover:bg-white/90"
                render={<Link href={evaluationIntakeHref()} />}
              >
                {messages.entityIntake.startIntake}
              </Button>
            ) : (
              <Button
                className="h-11 bg-white text-[#203442] hover:bg-white/90"
                render={<Link href="/evaluations/new?state=denied" />}
              >
                {messages.entityIntake.startIntake}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href="/company" />}
            >
              {messages.flow.backCompany}
            </Button>
          </div>
        </section>

        {state !== 'ready' ? (
          <EntityIntakeStateView state={state} retryHref="/entities" />
        ) : (
          <>
            <ConceptSeparationNotice />
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{intakeTenant.name}</CardTitle>
                <CardDescription>{messages.entityIntake.tenantScope}</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{messages.entityIntake.identity}</TableHead>
                      <TableHead className="hidden md:table-cell">
                        {messages.entityIntake.relationship}
                      </TableHead>
                      <TableHead>{messages.entityIntake.completeness}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {messages.entityIntake.updated}
                      </TableHead>
                      <TableHead className="text-right">{messages.company.open}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {northstarEntities.map((entity) => (
                      <TableRow key={entity.id}>
                        <TableCell>
                          <div className="grid gap-1">
                            <span className="font-medium">{entity.displayName}</span>
                            <span className="text-xs text-muted-foreground">
                              {entity.reference}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {messages.entityIntake.relationships[entity.relationship]}
                        </TableCell>
                        <TableCell>
                          <QualityStatus quality={entity.completeness} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {formatDateTime(entity.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            className="h-11"
                            render={<Link href={entityHref(entity.id)} />}
                          >
                            {messages.entityIntake.openRecord}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
