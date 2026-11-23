'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

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
import { AuditTimeline } from '@/components/prototype/audit-timeline';
import { RecommendationNotice } from '@/components/prototype/recommendation-notice';
import { CaseStatusBadge } from '@/components/prototype/status-badge';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import { currentTenant, presentation } from '@/lib/demo/data';
import {
  evidenceStateLabels,
  humanDecisionLabels,
  nextActionLabels,
  priorityLabels,
} from '@/lib/demo/labels';
import {
  getCase,
  getEvaluation,
  humanDecisions,
  timelineForCase,
} from '@/lib/demo/flow';
import { memberships } from '@/lib/demo/session';
import type { DemoTimelineEvent, HumanDecision, TimelineAction } from '@/lib/demo/types';
import { parseWorkbenchQuery, workbenchHref } from '@/lib/demo/workbench';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime, formatNumber } from '@/lib/i18n/presentation';

function decisionAction(decision: HumanDecision): TimelineAction {
  return decision === 'escalate' ? 'case.escalated' : 'decision.recorded';
}

export default function CaseDetailPage() {
  return (
    <Suspense>
      <CaseDetailContent />
    </Suspense>
  );
}

function CaseDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const notify = usePrototypeFeedback();
  const capabilities = memberships.find((item) => item.id === 'mem_helix_operator')
    ?.capabilities;
  const item = getCase(params.id);
  const evaluation = item?.evaluationId ? getEvaluation(item.evaluationId) : undefined;
  const workbenchQuery = parseWorkbenchQuery(searchParams);
  const workbenchReturn = workbenchHref(workbenchQuery);
  const fixtureEvents = useMemo(
    () => (item ? timelineForCase(item.id) : []),
    [item],
  );
  const [localEvents, setLocalEvents] = useState<DemoTimelineEvent[]>([]);
  const events = [...fixtureEvents, ...localEvents];

  function append(action: TimelineAction) {
    if (!item) {
      return;
    }
    setLocalEvents((current) => [
      ...current,
      {
        id: `local_${action}_${current.length}`,
        caseId: item.id,
        action,
        actor: currentTenant.operator,
        at: new Date().toISOString(),
        correlationId: item.correlationId,
      },
    ]);
  }

  return (
    <AppShell view="operator" capabilities={capabilities}>
      {!item ? (
        <Empty className="min-h-[22rem] border bg-card">
          <EmptyHeader>
            <EmptyTitle>{messages.flow.missingCaseTitle}</EmptyTitle>
            <EmptyDescription>{messages.flow.missingCaseBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="h-11" render={<Link href={workbenchReturn} />}>
              {messages.workbench.backToWorkbench}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid max-w-4xl gap-6">
          <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
            <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
              {messages.flow.case.kicker}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-[2rem] leading-[1.2] font-semibold">{item.subject}</h1>
              <CaseStatusBadge status={item.status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-white/80">{item.lastNote}</p>
          </section>

          <RecommendationNotice />

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.flow.case.slaLabel}</CardTitle>
                <CardDescription>
                  {formatDateTime(item.slaDueAt, presentation)}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.workbench.owner}</CardTitle>
                <CardDescription>{item.assignee}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.workbench.priority}</CardTitle>
                <CardDescription>{priorityLabels[item.priority]}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.workbench.lastActivity}</CardTitle>
                <CardDescription>
                  {formatDateTime(item.lastActivityAt, presentation)}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.workbench.evidenceState}</CardTitle>
                <CardDescription>
                  {evidenceStateLabels[item.evidenceState]}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.workbench.nextAction}</CardTitle>
                <CardDescription>{nextActionLabels[item.nextAction]}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.workbench.decision}</CardTitle>
                <CardDescription>
                  {item.recordedDecision
                    ? humanDecisionLabels[item.recordedDecision]
                    : messages.workbench.noDecision}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {evaluation ? (
            <Card>
              <CardHeader>
                <CardTitle>{messages.flow.case.linkedEvaluation}</CardTitle>
                <CardDescription>
                  {evaluation.externalRef} · {evaluation.policyVersion}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="h-11"
                  render={<Link href={`/evaluations/${evaluation.id}`} />}
                >
                  {messages.company.openEvaluation}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{messages.flow.case.evidenceTitle}</CardTitle>
              <CardDescription>{messages.flow.case.evidenceHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-mono text-sm text-muted-foreground">
                {interpolate(messages.operator.slaLine, {
                  due: formatDateTime(item.slaDueAt, presentation),
                  count: formatNumber(item.evidenceCount, presentation),
                  assignee: item.assignee,
                })}
              </p>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => {
                  notify(
                    messages.flow.case.toastEvidenceTitle,
                    messages.flow.case.toastEvidenceBody,
                  );
                  append('evidence.requested');
                }}
              >
                {messages.flow.case.requestEvidence}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.flow.case.decisionTitle}</CardTitle>
              <CardDescription>{messages.flow.case.decisionHint}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {humanDecisions.map((decision) => (
                <Button
                  key={decision}
                  variant={decision === 'approve' ? 'default' : 'outline'}
                  className="h-11"
                  onClick={() => {
                    notify(
                      messages.flow.case.toastDecisionTitle,
                      interpolate(messages.flow.case.toastDecisionBody, {
                        decision: humanDecisionLabels[decision],
                      }),
                    );
                    append(decisionAction(decision));
                  }}
                >
                  {humanDecisionLabels[decision]}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.flow.case.timelineTitle}</CardTitle>
              <CardDescription>{messages.flow.case.timelineHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTimeline events={events} />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" render={<Link href={workbenchReturn} />}>
              {messages.workbench.backToWorkbench}
            </Button>
            <Button variant="outline" className="h-11" render={<Link href="/operator" />}>
              {messages.flow.backOperator}
            </Button>
            <Button variant="ghost" className="h-11" render={<Link href="/company" />}>
              {messages.flow.backCompany}
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
