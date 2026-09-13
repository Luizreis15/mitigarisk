'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WorkspaceChrome } from '@/components/prototype/workspace-chrome';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import { invitationActor, membershipById } from '@/lib/demo/session';
import { interpolate, messages } from '@/lib/i18n/messages';

function InviteContent() {
  const notify = usePrototypeFeedback();
  const params = useSearchParams();
  const membership = membershipById(params.get('membership') ?? 'mem_cedar_invite');

  if (!membership || membership.status !== 'invited') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{messages.invite.title}</CardTitle>
          <CardDescription>{messages.invite.missing}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
        <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
          {messages.invite.kicker}
        </p>
        <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
          {messages.invite.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/80">
          {interpolate(messages.invite.intro, {
            name: invitationActor.name,
            tenant: membership.tenantName,
          })}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{membership.tenantName}</CardTitle>
          <CardDescription>{messages.invite.waiting}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">{messages.invite.capabilities}</p>
            <p className="text-sm text-muted-foreground">{messages.invite.noneYet}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-11"
              onClick={() =>
                notify(messages.invite.toastAcceptTitle, messages.invite.toastAcceptBody)
              }
            >
              {messages.invite.accept}
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() =>
                notify(messages.invite.toastDeclineTitle, messages.invite.toastDeclineBody)
              }
            >
              {messages.invite.decline}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <WorkspaceChrome eyebrow={messages.invite.kicker}>
      <Suspense>
        <InviteContent />
      </Suspense>
    </WorkspaceChrome>
  );
}
