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
import type { CompanyAdminWorkspaceState } from '@/lib/demo/company-admin';
import { messages } from '@/lib/i18n/messages';

export function CompanyAdminStateView({
  state,
  retryHref,
}: {
  state: Exclude<CompanyAdminWorkspaceState, 'ready'>;
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
          aria-label={messages.companyAdmin.loadingLabel}
        />
        <p className="text-[1.375rem] leading-[1.3] font-semibold">
          {messages.companyAdmin.loadingTitle}
        </p>
        <p className="max-w-lg text-sm text-muted-foreground">
          {messages.companyAdmin.loadingBody}
        </p>
      </div>
    );
  }

  const copy =
    state === 'error'
      ? {
          title: messages.companyAdmin.errorTitle,
          body: messages.companyAdmin.errorBody,
          icon: CircleAlertIcon,
        }
      : state === 'denied'
        ? {
            title: messages.companyAdmin.deniedTitle,
            body: messages.companyAdmin.deniedBody,
            icon: ShieldOffIcon,
          }
        : {
            title: messages.companyAdmin.emptyTitle,
            body: messages.companyAdmin.emptyBody,
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
              {messages.companyAdmin.retry}
            </Button>
          ) : null}
          {state === 'denied' ? (
            <Button
              className="h-11"
              render={<Link href="/denied?capability=tenant.manage_members" />}
            >
              {messages.denied.title}
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-11"
            render={<Link href="/tenants" />}
          >
            {messages.emptyWorkspace.ctaWorkspaces}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}

export function CompanyAdminLoadingFallback() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center">
      <Loader2Icon
        className="size-6 animate-spin text-muted-foreground"
        aria-label={messages.companyAdmin.loadingLabel}
      />
    </div>
  );
}
