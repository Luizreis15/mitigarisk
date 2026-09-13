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
import { EvaluationResult } from '@/components/prototype/evaluation-result';
import { RecommendationNotice } from '@/components/prototype/recommendation-notice';
import {
  caseIdForEvaluation,
  getEvaluation,
  isNewlyOpenedCase,
} from '@/lib/demo/flow';
import { memberships } from '@/lib/demo/session';
import { messages } from '@/lib/i18n/messages';

export default function EvaluationDetailPage() {
  const params = useParams<{ id: string }>();
  const capabilities = memberships.find((item) => item.id === 'mem_helix_company')
    ?.capabilities;
  const evaluation = getEvaluation(params.id);
  const linkedCaseId = evaluation ? caseIdForEvaluation(evaluation.id) : undefined;

  return (
    <AppShell view="company" capabilities={capabilities}>
      {!evaluation ? (
        <Empty className="min-h-[22rem] border bg-card">
          <EmptyHeader>
            <EmptyTitle>{messages.flow.missingEvaluationTitle}</EmptyTitle>
            <EmptyDescription>{messages.flow.missingEvaluationBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="h-11" render={<Link href="/company" />}>
              {messages.flow.backCompany}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid max-w-4xl gap-6">
          <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
            <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
              {messages.flow.evaluation.kicker}
            </p>
            <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
              {evaluation.externalRef}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/80">{evaluation.subject}</p>
          </section>

          <RecommendationNotice />

          <Card>
            <CardHeader>
              <CardTitle>{messages.flow.evaluation.resultKicker}</CardTitle>
              <CardDescription>
                {messages.flow.evaluation.provenanceHint}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <EvaluationResult evaluation={evaluation} />
              <div className="flex flex-wrap gap-2">
                {linkedCaseId ? (
                  <Button
                    className="h-11"
                    render={<Link href={`/cases/${linkedCaseId}`} />}
                  >
                    {isNewlyOpenedCase(linkedCaseId)
                      ? messages.flow.evaluation.createCase
                      : messages.flow.evaluation.openCase}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="h-11"
                  render={<Link href="/company" />}
                >
                  {messages.flow.backCompany}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
