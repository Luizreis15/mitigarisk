import Link from 'next/link';
import { CircleAlertIcon, Loader2Icon, ShieldOffIcon, Building2Icon } from 'lucide-react';

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
import type { GovernanceWorkspaceState } from '@/lib/demo/platform-governance';
import { messages } from '@/lib/i18n/messages';

export function PlatformGovernanceStateView({
  state,
  retryHref,
}: {
  state: Exclude<GovernanceWorkspaceState, 'ready'>;
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
          aria-label={messages.platformGovernance.loadingLabel}
        />
        <p className="text-[1.375rem] leading-[1.3] font-semibold">
          {messages.platformGovernance.loadingTitle}
        </p>
        <p className="max-w-lg text-sm text-muted-foreground">
          {messages.platformGovernance.loadingBody}
        </p>
      </div>
    );
  }

  const copy =
    state === 'error'
      ? {
          title: messages.platformGovernance.errorTitle,
          body: messages.platformGovernance.errorBody,
          icon: CircleAlertIcon,
        }
      : state === 'denied'
        ? {
            title: messages.platformGovernance.deniedTitle,
            body: messages.platformGovernance.deniedBody,
            icon: ShieldOffIcon,
          }
        : {
            title: messages.platformGovernance.emptyTitle,
            body: messages.platformGovernance.emptyBody,
            icon: Building2Icon,
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
              {messages.platformGovernance.retry}
            </Button>
          ) : null}
          {state === 'denied' ? (
            <Button
              className="h-11"
              render={<Link href="/denied?capability=platform.admin" />}
            >
              {messages.denied.title}
            </Button>
          ) : null}
          <Button variant="outline" className="h-11" render={<Link href="/super-admin" />}>
            {messages.platformGovernance.backSuperAdmin}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}

export function PlatformGovernanceLoadingFallback() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center">
      <Loader2Icon
        className="size-6 animate-spin text-muted-foreground"
        aria-label={messages.platformGovernance.loadingLabel}
      />
    </div>
  );
}
