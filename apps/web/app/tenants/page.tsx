'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WorkspaceChrome } from '@/components/prototype/workspace-chrome';
import { firstCompanyOnboarding, memberships, prototypeScenarios, sessionActor } from '@/lib/demo/session';
import { roleLabels } from '@/lib/demo/labels';
import type { MembershipViewModel } from '@/lib/demo/types';
import { interpolate, messages } from '@/lib/i18n/messages';

function actionLabel(membership: MembershipViewModel) {
  if (membership.status === 'invited') {
    return messages.tenants.reviewInvite;
  }
  return messages.tenants.open;
}

export default function TenantsPage() {
  return (
    <WorkspaceChrome eyebrow={messages.tenants.kicker}>
      <div className="grid gap-8">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white shadow-[var(--shadow-sm)]">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.tenants.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.tenants.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {messages.tenants.intro}
          </p>
          <p className="mt-4 text-sm text-white/70">
            {interpolate(messages.tenants.actorLine, {
              name: sessionActor.name,
              email: sessionActor.email,
            })}
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-[1.375rem] leading-[1.3] font-semibold">
            {messages.tenants.yourWorkspaces}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {memberships.map((membership) => (
              <Card key={membership.id}>
                <CardHeader>
                  <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
                    {messages.session.membership[membership.status]}
                  </p>
                  <CardTitle className="text-base">{membership.tenantName}</CardTitle>
                  <CardDescription>
                    {interpolate(messages.tenants.roleLine, {
                      role: roleLabels[membership.role],
                      status: messages.session.membership[membership.status],
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="h-11" render={<Link href={membership.href} />}>
                    {actionLabel(membership)}
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardHeader>
                <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
                  {messages.session.membership.onboarding}
                </p>
                <CardTitle className="text-base">{messages.tenants.startCompany}</CardTitle>
                <CardDescription>{messages.tenants.startCompanyHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  className="h-11"
                  render={<Link href={firstCompanyOnboarding.href} />}
                >
                  {messages.tenants.continueSetup}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-3">
          <div>
            <h2 className="text-[1.375rem] leading-[1.3] font-semibold">
              {messages.tenants.scenarios}
            </h2>
            <p className="text-sm text-muted-foreground">{messages.tenants.scenariosHint}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prototypeScenarios.map((scenario) => (
              <Button
                key={scenario.id}
                variant="outline"
                className="h-11 justify-start"
                render={<Link href={scenario.href} />}
              >
                {messages.tenants.scenario[scenario.id]}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceChrome>
  );
}
