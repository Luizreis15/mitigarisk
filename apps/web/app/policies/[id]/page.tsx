'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { InfoIcon } from 'lucide-react';
import { AppShell } from '@/components/prototype/app-shell';
import { RecommendationNotice } from '@/components/prototype/recommendation-notice';
import {
  PolicyLifecycleStatus,
  RiskStatus,
} from '@/components/prototype/status-badge';
import { presentation } from '@/lib/demo/data';
import {
  policyHistoryLabels,
  policyPathLabels,
} from '@/lib/demo/labels';
import {
  getPolicy,
  historyForPolicy,
  parsePolicyQuery,
  policyDetailHref,
  policyListHref,
} from '@/lib/demo/policy-workbench';
import { memberships } from '@/lib/demo/session';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime, formatNumber } from '@/lib/i18n/presentation';

export default function PolicyDetailPage() {
  return (
    <Suspense>
      <PolicyDetailContent />
    </Suspense>
  );
}

function effectiveCopy(from: string | null, to: string | null) {
  if (!from) {
    return messages.policy.notEffective;
  }
  if (!to) {
    return interpolate(messages.policy.effectiveOpen, {
      from: formatDateTime(from, presentation),
    });
  }
  return interpolate(messages.policy.effectiveRange, {
    from: formatDateTime(from, presentation),
    to: formatDateTime(to, presentation),
  });
}

function PolicyDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const query = parsePolicyQuery(searchParams);
  const capabilities = memberships.find((item) => item.id === 'mem_helix_company')
    ?.capabilities;
  const policy = getPolicy(params.id);
  const history = policy ? historyForPolicy(policy.id) : [];
  const notice =
    policy?.lifecycle === 'published'
      ? messages.policy.publishedImmutable
      : policy?.lifecycle === 'draft'
        ? messages.policy.draftNotice
        : messages.policy.archivedNotice;

  return (
    <AppShell view="company" capabilities={capabilities}>
      {!policy ? (
        <Empty className="min-h-[22rem] border bg-card">
          <EmptyHeader>
            <EmptyTitle>{messages.policy.missingTitle}</EmptyTitle>
            <EmptyDescription>{messages.policy.missingBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="h-11" render={<Link href={policyListHref(query)} />}>
              {messages.policy.backToList}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid max-w-4xl gap-6">
          <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
            <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
              {messages.policy.kicker}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-[1.75rem] leading-[1.2] font-semibold">
                {policy.id}
              </h1>
              <PolicyLifecycleStatus lifecycle={policy.lifecycle} />
            </div>
            <p className="mt-2 text-sm leading-6 text-white/80">{policy.name}</p>
          </section>

          <RecommendationNotice />

          <Alert className="border-[#c5d4dc] bg-[#e4edf2]">
            <InfoIcon />
            <AlertTitle>{messages.policy.lifecycle}</AlertTitle>
            <AlertDescription>
              {notice}
              {policy.supersededBy
                ? ` ${interpolate(messages.policy.supersededBy, { id: policy.supersededBy })}`
                : ''}
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.policy.identity}</CardTitle>
                <CardDescription className="font-mono">{policy.id}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.policy.version}</CardTitle>
                <CardDescription>{policy.versionNumber}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.policy.owner}</CardTitle>
                <CardDescription>{policy.owner}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{messages.policy.effective}</CardTitle>
                <CardDescription>
                  {effectiveCopy(policy.effectiveFrom, policy.effectiveTo)}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="sm:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{messages.policy.lastActivity}</CardTitle>
                <CardDescription>
                  {formatDateTime(policy.lastActivityAt, presentation)}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {policy.supersededBy ? (
            <Button
              variant="outline"
              className="h-11 w-fit"
              render={<Link href={policyDetailHref(policy.supersededBy, query)} />}
            >
              {interpolate(messages.policy.supersededBy, { id: policy.supersededBy })}
            </Button>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{messages.policy.factorsTitle}</CardTitle>
              <CardDescription>{messages.policy.factorsHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {policy.factors.map((factor) => (
                <div
                  key={factor.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <p className="text-sm font-medium">
                    {messages.company.dimensions[factor.key]}
                  </p>
                  <p className="font-mono text-sm">
                    {interpolate(messages.policy.weight, {
                      value: formatNumber(factor.weight, presentation),
                    })}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.policy.thresholdsTitle}</CardTitle>
              <CardDescription>{messages.policy.thresholdsHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {policy.thresholds.map((threshold) => (
                <div
                  key={`${threshold.minScore}-${threshold.maxScore}`}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3"
                >
                  <div>
                    <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
                      {messages.policy.scoreRange}
                    </p>
                    <p className="mt-1 font-mono text-sm">
                      {interpolate(messages.policy.thresholdRange, {
                        min: formatNumber(threshold.minScore, presentation),
                        max: formatNumber(threshold.maxScore, presentation),
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
                      {messages.policy.scoreBand}
                    </p>
                    <div className="mt-1">
                      <RiskStatus band={threshold.scoreBand} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
                      {messages.policy.recommendationPath}
                    </p>
                    <p className="mt-1 text-sm">
                      {policyPathLabels[threshold.recommendationPath]}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.policy.historyTitle}</CardTitle>
              <CardDescription>{messages.policy.historyHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3">
                {history.map((event) => (
                  <li key={event.id} className="rounded-lg border bg-card p-3">
                    <p className="text-sm font-medium">
                      {policyHistoryLabels[event.action]}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {interpolate(messages.policy.token, { action: event.action })}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {event.actor} · {formatDateTime(event.at, presentation)} ·{' '}
                      {event.correlationId}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="h-11 w-fit"
            render={<Link href={policyListHref(query)} />}
          >
            {messages.policy.backToList}
          </Button>
        </div>
      )}
    </AppShell>
  );
}
