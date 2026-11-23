'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { WorkspaceChrome } from '@/components/prototype/workspace-chrome';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import { onboardingSteps } from '@/lib/demo/session';
import { interpolate, messages } from '@/lib/i18n/messages';

export default function OnboardingPage() {
  const notify = usePrototypeFeedback();
  const [stepIndex, setStepIndex] = useState(0);
  const step = onboardingSteps[stepIndex];
  const total = onboardingSteps.length;
  const copy = messages.onboarding.steps[step.id];
  const percent = Math.round(((stepIndex + 1) / total) * 100);

  return (
    <WorkspaceChrome eyebrow={messages.onboarding.kicker}>
      <div className="grid max-w-3xl gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.onboarding.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.onboarding.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/80">{messages.onboarding.intro}</p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">{messages.onboarding.progressLabel}</p>
          <p className="text-sm text-muted-foreground">
            {interpolate(messages.onboarding.progressValue, {
              current: stepIndex + 1,
              total,
            })}
          </p>
          <Progress value={percent} className="w-full">
            <span className="sr-only">
              {interpolate(messages.onboarding.progressValue, {
                current: stepIndex + 1,
                total,
              })}
            </span>
          </Progress>
        </div>

        <ol className="grid gap-2">
          {onboardingSteps.map((item, index) => (
            <li
              key={item.id}
              aria-current={index === stepIndex ? 'step' : undefined}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-3 text-sm"
            >
              <span>
                {messages.onboarding.steps[item.id].title}
                {index === stepIndex ? ` · ${messages.onboarding.current}` : ''}
              </span>
              <span className="text-muted-foreground">
                {item.optional ? messages.onboarding.optional : messages.onboarding.required}
              </span>
            </li>
          ))}
        </ol>

        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.body}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
            >
              {messages.onboarding.back}
            </Button>
            {stepIndex < total - 1 ? (
              <Button
                className="h-11"
                onClick={() => {
                  notify(
                    messages.onboarding.toastStepTitle,
                    messages.onboarding.toastStepBody,
                  );
                  setStepIndex((value) => Math.min(total - 1, value + 1));
                }}
              >
                {messages.onboarding.continue}
              </Button>
            ) : (
              <Button
                className="h-11"
                onClick={() =>
                  notify(
                    messages.onboarding.toastFinishTitle,
                    messages.onboarding.toastFinishBody,
                  )
                }
              >
                {messages.onboarding.finish}
              </Button>
            )}
            <Button
              variant="secondary"
              className="h-11"
              render={<Link href="/company?state=empty" />}
            >
              {messages.onboarding.openWorkspace}
            </Button>
          </CardContent>
        </Card>
      </div>
    </WorkspaceChrome>
  );
}
