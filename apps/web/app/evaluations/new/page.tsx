'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppShell } from '@/components/prototype/app-shell';
import { RecommendationNotice } from '@/components/prototype/recommendation-notice';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import { memberships } from '@/lib/demo/session';
import { messages } from '@/lib/i18n/messages';

const startedEvaluationId = 'ev_10510';

export default function NewEvaluationPage() {
  const router = useRouter();
  const notify = usePrototypeFeedback();
  const capabilities = memberships.find((item) => item.id === 'mem_helix_company')
    ?.capabilities;
  const [subject, setSubject] = useState<string>(
    messages.flow.evaluation.subjectPlaceholder,
  );
  const [reference, setReference] = useState<string>(
    messages.flow.evaluation.referencePlaceholder,
  );

  return (
    <AppShell view="company" capabilities={capabilities}>
      <div className="grid max-w-3xl gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.flow.evaluation.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.flow.evaluation.newTitle}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {messages.flow.evaluation.newIntro}
          </p>
        </section>

        <RecommendationNotice />

        <Card>
          <CardHeader>
            <CardTitle>{messages.flow.evaluation.newTitle}</CardTitle>
            <CardDescription>{messages.flow.evaluation.newIntro}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                notify(
                  messages.flow.evaluation.toastTitle,
                  messages.flow.evaluation.toastBody,
                );
                router.push(`/evaluations/${startedEvaluationId}`);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="eval-subject">{messages.flow.evaluation.subjectLabel}</Label>
                <Input
                  id="eval-subject"
                  className="h-11"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eval-ref">{messages.flow.evaluation.referenceLabel}</Label>
                <Input
                  id="eval-ref"
                  className="h-11"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="h-11">
                  {messages.flow.evaluation.submit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  render={<Link href="/company" />}
                >
                  {messages.flow.backCompany}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
