import Link from 'next/link';
import { CircleAlertIcon, Loader2Icon, ShieldOffIcon, UsersIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import type { IntakeWorkspaceState } from '@/lib/demo/entity-intake';
import { messages } from '@/lib/i18n/messages';

export function EntityIntakeStateView({
  state,
  retryHref,
}: {
  state: Exclude<IntakeWorkspaceState, 'ready'>;
  retryHref: string;
}) {
  if (state === 'loading') {
    return (
      <div
        className="flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-6 text-center"
        aria-busy="true"
        aria-live="polite"
      >
        <Spinner
          className="size-8 text-muted-foreground"
          aria-label={messages.entityIntake.loadingLabel}
        />
        <p className="text-[1.375rem] leading-[1.3] font-semibold">
          {messages.entityIntake.loadingTitle}
        </p>
        <p className="max-w-lg text-sm text-muted-foreground">
          {messages.entityIntake.loadingBody}
        </p>
      </div>
    );
  }

  const copy =
    state === 'error'
      ? {
          title: messages.entityIntake.errorTitle,
          body: messages.entityIntake.errorBody,
          icon: CircleAlertIcon,
        }
      : state === 'denied'
        ? {
            title: messages.entityIntake.deniedTitle,
            body: messages.entityIntake.deniedBody,
            icon: ShieldOffIcon,
          }
        : {
            title: messages.entityIntake.emptyTitle,
            body: messages.entityIntake.emptyBody,
            icon: UsersIcon,
          };

  const Icon = copy.icon;

  return (
    <Empty className="min-h-[22rem] border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{copy.title}</EmptyTitle>
        <EmptyDescription>{copy.body}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {state === 'error' ? (
            <Button className="h-11" render={<Link href={retryHref} />}>
              {messages.entityIntake.retry}
            </Button>
          ) : null}
          {state === 'denied' ? (
            <Button
              className="h-11"
              render={<Link href="/denied?capability=company.evaluate" />}
            >
              {messages.denied.title}
            </Button>
          ) : null}
          <Button variant="outline" className="h-11" render={<Link href="/tenants" />}>
            {messages.emptyWorkspace.ctaWorkspaces}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}

export function EntityIntakeLoadingFallback() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center">
      <Loader2Icon
        className="size-6 animate-spin text-muted-foreground"
        aria-label={messages.entityIntake.loadingLabel}
      />
    </div>
  );
}
