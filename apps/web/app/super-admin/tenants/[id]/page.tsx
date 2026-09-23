'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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
import { PlatformBoundaryNotice } from '@/components/prototype/platform-boundary-notice';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import {
  canGovernTenants,
  getGovernedTenant,
  governanceListHref,
  platformAdminCapabilities,
} from '@/lib/demo/platform-governance';
import { messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';
import { presentation } from '@/lib/demo/data';

type GovernanceAction = 'provision' | 'suspend' | 'reactivate' | 'support';

export default function TenantGovernanceDetailPage() {
  const params = useParams<{ id: string }>();
  const capabilities = platformAdminCapabilities();
  const tenant = getGovernedTenant(params.id);
  const notify = usePrototypeFeedback();
  const [action, setAction] = useState<GovernanceAction | null>(null);

  if (!canGovernTenants(capabilities)) {
    return (
      <AppShell view="super-admin" capabilities={capabilities}>
        <Empty className="min-h-[22rem] border bg-card">
          <EmptyHeader>
            <EmptyTitle>{messages.platformGovernance.deniedTitle}</EmptyTitle>
            <EmptyDescription>{messages.platformGovernance.deniedBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              className="h-11"
              render={<Link href="/denied?capability=platform.admin" />}
            >
              {messages.denied.title}
            </Button>
          </EmptyContent>
        </Empty>
      </AppShell>
    );
  }

  if (!tenant) {
    return (
      <AppShell view="super-admin" capabilities={capabilities}>
        <Empty className="min-h-[22rem] border bg-card">
          <EmptyHeader>
            <EmptyTitle>{messages.platformGovernance.missingTitle}</EmptyTitle>
            <EmptyDescription>{messages.platformGovernance.missingBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="h-11" render={<Link href={governanceListHref()} />}>
              {messages.platformGovernance.backDirectory}
            </Button>
          </EmptyContent>
        </Empty>
      </AppShell>
    );
  }

  const copy = actionCopy(action);

  return (
    <AppShell view="super-admin" capabilities={capabilities}>
      <div className="grid max-w-4xl gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.platformGovernance.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">{tenant.name}</h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {messages.platformGovernance.detailIntro}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              className="h-11 bg-white text-[#203442] hover:bg-white/90"
              render={<Link href={governanceListHref()} />}
            >
              {messages.platformGovernance.backDirectory}
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href="/super-admin" />}
            >
              {messages.platformGovernance.backSuperAdmin}
            </Button>
          </div>
        </section>

        <PlatformBoundaryNotice />

        <section
          aria-labelledby="gov-concepts"
          className="grid gap-2 rounded-2xl border bg-card p-4 text-sm leading-6 text-muted-foreground"
        >
          <h2 id="gov-concepts" className="text-base font-semibold text-foreground">
            {messages.platformGovernance.conceptsTitle}
          </h2>
          <ul className="grid gap-2">
            <li>{messages.platformGovernance.conceptAudit}</li>
            <li>{messages.platformGovernance.conceptConfig}</li>
            <li>{messages.platformGovernance.conceptPolicy}</li>
            <li>{messages.platformGovernance.conceptRecommendation}</li>
            <li>{messages.platformGovernance.conceptDecision}</li>
          </ul>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{messages.platformGovernance.identity}</CardTitle>
              <CardDescription>{tenant.id}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row label={messages.platformGovernance.slug} value={tenant.slug} />
              <Row
                label={messages.platformGovernance.environment}
                value={tenant.environment}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {messages.platformGovernance.lifecycle}
                </span>
                <Badge variant="outline">
                  {messages.platformGovernance.lifecycleValues[tenant.lifecycle]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {messages.platformGovernance.visibility}
                </span>
                <Badge variant="secondary">
                  {messages.platformGovernance.visibilityValues[tenant.visibility]}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.platformGovernance.memberships}</CardTitle>
              <CardDescription>
                {messages.platformGovernance.detailIntro}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row
                label={messages.platformGovernance.membershipActive}
                value={String(tenant.membershipActive)}
              />
              <Row
                label={messages.platformGovernance.membershipInvited}
                value={String(tenant.membershipInvited)}
              />
              <Row
                label={messages.platformGovernance.membershipSuspended}
                value={String(tenant.membershipSuspended)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.platformGovernance.policyPosture}</CardTitle>
              <CardDescription>
                {messages.platformGovernance.conceptPolicy}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row
                label={messages.platformGovernance.policyPosture}
                value={messages.platformGovernance.policyValues[tenant.policyPosture]}
              />
              <Row
                label={messages.platformGovernance.policyVersion}
                value={tenant.policyVersion ?? messages.platformGovernance.noPolicy}
              />
              <Row
                label={messages.platformGovernance.configuration}
                value={
                  messages.platformGovernance.configurationValues[tenant.configuration]
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.platformGovernance.auditSignal}</CardTitle>
              <CardDescription>
                {messages.platformGovernance.conceptAudit}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row
                label={messages.platformGovernance.lastAction}
                value={tenant.lastAuditAction}
              />
              <Row label={messages.platformGovernance.actor} value={tenant.lastAuditActor} />
              <Row
                label={messages.platformGovernance.when}
                value={formatDateTime(tenant.lastAuditAt, presentation)}
              />
              <Row
                label={messages.platformGovernance.correlation}
                value={tenant.correlationId}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{messages.platformGovernance.actionsTitle}</CardTitle>
            <CardDescription>{messages.platformGovernance.actionsHint}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {tenant.lifecycle === 'draft' ? (
              <Button className="h-11" onClick={() => setAction('provision')}>
                {messages.platformGovernance.provision}
              </Button>
            ) : null}
            {tenant.lifecycle === 'active' ? (
              <Button className="h-11" onClick={() => setAction('suspend')}>
                {messages.platformGovernance.suspend}
              </Button>
            ) : null}
            {tenant.lifecycle === 'suspended' ? (
              <Button className="h-11" onClick={() => setAction('reactivate')}>
                {messages.platformGovernance.reactivate}
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setAction('support')}
            >
              {messages.platformGovernance.supportAccess}
            </Button>
            <Button variant="ghost" className="h-11" render={<Link href="/company" />}>
              {messages.platformGovernance.openCompanyContext}
            </Button>
            <Button variant="ghost" className="h-11" render={<Link href="/operator" />}>
              {messages.platformGovernance.openOperatorContext}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.platformGovernance.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                notify(copy.toastTitle, copy.toastBody);
                setAction(null);
              }}
            >
              {messages.platformGovernance.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function actionCopy(action: GovernanceAction | null) {
  switch (action) {
    case 'provision':
      return {
        title: messages.platformGovernance.provisionTitle,
        body: messages.platformGovernance.provisionBody,
        toastTitle: messages.platformGovernance.toastProvisionTitle,
        toastBody: messages.platformGovernance.toastProvisionBody,
      };
    case 'reactivate':
      return {
        title: messages.platformGovernance.reactivateTitle,
        body: messages.platformGovernance.reactivateBody,
        toastTitle: messages.platformGovernance.toastReactivateTitle,
        toastBody: messages.platformGovernance.toastReactivateBody,
      };
    case 'support':
      return {
        title: messages.platformGovernance.supportTitle,
        body: messages.platformGovernance.supportBody,
        toastTitle: messages.platformGovernance.toastSupportTitle,
        toastBody: messages.platformGovernance.toastSupportBody,
      };
    default:
      return {
        title: messages.platformGovernance.suspendTitle,
        body: messages.platformGovernance.suspendBody,
        toastTitle: messages.platformGovernance.toastSuspendTitle,
        toastBody: messages.platformGovernance.toastSuspendBody,
      };
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
