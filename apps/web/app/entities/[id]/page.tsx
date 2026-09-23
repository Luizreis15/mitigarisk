'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { AppShell } from '@/components/prototype/app-shell';
import { ConceptSeparationNotice } from '@/components/prototype/concept-separation-notice';
import { QualityStatus } from '@/components/prototype/status-badge';
import {
  canStartEvaluation,
  companyEvaluateCapabilities,
  evaluationIntakeHref,
  getEntity,
  intakeTenant,
} from '@/lib/demo/entity-intake';
import { interpolate, messages } from '@/lib/i18n/messages';
import { presentation } from '@/lib/demo/data';
import { formatDateTime } from '@/lib/i18n/presentation';

export default function EntityDetailPage() {
  const params = useParams<{ id: string }>();
  const capabilities = companyEvaluateCapabilities();
  const entity = getEntity(params.id);

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
      {!entity ? (
        <Empty className="min-h-[22rem] border bg-card">
          <EmptyHeader>
            <EmptyTitle>{messages.entityIntake.missingTitle}</EmptyTitle>
            <EmptyDescription>{messages.entityIntake.missingBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="h-11" render={<Link href="/entities" />}>
              {messages.entityIntake.listTitle}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid max-w-4xl gap-6">
          <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
            <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
              {messages.entityIntake.kicker}
            </p>
            <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
              {entity.displayName}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/80">{entity.reference}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {canStartEvaluation(capabilities) ? (
                <Button
                  className="h-11 bg-white text-[#203442] hover:bg-white/90"
                  render={<Link href={evaluationIntakeHref(entity.id)} />}
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
                render={<Link href="/entities" />}
              >
                {messages.entityIntake.listTitle}
              </Button>
            </div>
          </section>

          <ConceptSeparationNotice />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{messages.entityIntake.identity}</CardTitle>
                <CardDescription>{messages.entityIntake.facts}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Row label={messages.entityIntake.displayName} value={entity.displayName} />
                <Row label={messages.entityIntake.reference} value={entity.reference} />
                <Row
                  label={messages.entityIntake.relationship}
                  value={messages.entityIntake.relationships[entity.relationship]}
                />
                <Row label={messages.entityIntake.contactEmail} value={entity.contactEmail} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{messages.entityIntake.signals}</CardTitle>
                <CardDescription>{messages.entityIntake.completeness}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Row
                  label={messages.entityIntake.channel}
                  value={messages.entityIntake.channels[entity.channel]}
                />
                <Row
                  label={messages.entityIntake.activityBand}
                  value={messages.entityIntake.activityBands[entity.activityBand]}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {messages.entityIntake.completeness}
                  </span>
                  <QualityStatus quality={entity.completeness} />
                </div>
                <Row
                  label={messages.entityIntake.provenance}
                  value={messages.entityIntake.provenanceValues[entity.provenance]}
                />
                <Row
                  label={messages.entityIntake.recorded}
                  value={formatDateTime(entity.recordedAt)}
                />
                <Row
                  label={messages.entityIntake.updated}
                  value={formatDateTime(entity.updatedAt)}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{messages.entityIntake.facts}</CardTitle>
              <CardDescription>
                {interpolate(messages.presentation.summary, {
                  timeZone: presentation.timeZone,
                  currency: presentation.currency,
                  locale: presentation.locale,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-6">{entity.declaredFacts}</CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
