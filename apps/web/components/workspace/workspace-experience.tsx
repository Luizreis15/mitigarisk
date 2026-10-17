import Link from 'next/link';
import {
  ArrowRightIcon,
  ClipboardCheckIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';

import { WorkspaceSessionActions } from '@/components/workspace/workspace-session-actions';
import { WorkspaceStatus } from '@/components/workspace/workspace-status';
import { WorkspaceTenantSelection } from '@/components/workspace/workspace-tenant-selection';
import { RealWorkspaceShell } from '@/components/workspace/real-workspace-shell';
import { Button } from '@/components/ui/button';
import type { WorkspaceViewModel } from '@/lib/domain/workspace-access';
import type { TenantId } from '@/lib/domain/ids';
import { interpolate, messages } from '@/lib/i18n/messages';

export function WorkspaceExperience({
  model,
  realEntryTenantId,
  customerEntryTenantId,
  accessEntryTenantId,
}: {
  model: WorkspaceViewModel;
  realEntryTenantId?: TenantId | null;
  customerEntryTenantId?: TenantId | null;
  accessEntryTenantId?: TenantId | null;
}) {
  const hub = messages.realShell.hub;
  const isActiveMember = model.kind === 'active_member';
  const tenantId = customerEntryTenantId ?? realEntryTenantId ?? null;

  if (
    model.kind === 'config_unavailable' ||
    model.kind === 'read_failure' ||
    model.kind === 'no_membership' ||
    model.kind === 'invalid_selection' ||
    model.kind === 'tenant_selection_required' ||
    model.kind === 'platform_admin'
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-canvas)] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <p className="text-[0.7rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {messages.brand}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{messages.workspace.title}</h1>
          {model.signedInEmail ? (
            <p className="text-sm text-muted-foreground">
              {interpolate(messages.workspace.signedInAs, { email: model.signedInEmail })}
            </p>
          ) : null}
          <WorkspaceStatus model={model} />
          {model.kind === 'tenant_selection_required' ? (
            <WorkspaceTenantSelection options={model.tenantOptions} />
          ) : null}
          {model.kind === 'invalid_selection' ? (
            <Link
              href="/workspace"
              className="block rounded-md border border-border px-3 py-2 text-center text-sm hover:bg-accent"
            >
              {messages.workspace.tryAgainLink}
            </Link>
          ) : null}
          <WorkspaceSessionActions
            showsAuthenticatedSession={model.showsAuthenticatedSession}
          />
        </div>
      </main>
    );
  }

  if (!isActiveMember) {
    return null;
  }

  return (
    <RealWorkspaceShell
      tenantName={model.selectedTenantName}
      signedInEmail={model.signedInEmail}
      tenantId={tenantId}
    >
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {messages.brand}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {hub.title}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">{hub.subtitle}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {model.selectedTenantName ? (
              <span>
                {interpolate(hub.company, { tenantName: model.selectedTenantName })}
              </span>
            ) : null}
            {model.signedInEmail ? (
              <span>{interpolate(hub.signedIn, { email: model.signedInEmail })}</span>
            ) : null}
          </div>
          <p className="text-xs font-medium text-muted-foreground">{hub.demoNote}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {customerEntryTenantId ? (
            <article className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
              <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UsersIcon className="size-5" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-medium">{hub.customersTitle}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {hub.customersBody}
              </p>
              <Button
                className="mt-6 h-11 w-full sm:w-auto"
                render={
                  <Link href={`/workspace/customers?tenant=${customerEntryTenantId}`} />
                }
              >
                {hub.customersAction}
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            </article>
          ) : null}

          {realEntryTenantId ? (
            <article className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
              <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardCheckIcon className="size-5" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-medium">{hub.suppliersTitle}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {hub.suppliersBody}
              </p>
              <Button
                className="mt-6 h-11 w-full sm:w-auto"
                render={<Link href={`/workspace/suppliers?tenant=${realEntryTenantId}`} />}
              >
                {hub.suppliersAction}
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            </article>
          ) : null}

          {accessEntryTenantId ? (
            <article className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
              <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheckIcon className="size-5" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-medium">{hub.accessTitle}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {hub.accessBody}
              </p>
              <Button
                className="mt-6 h-11 w-full sm:w-auto"
                render={<Link href={`/workspace/access?tenant=${accessEntryTenantId}`} />}
              >
                {hub.accessAction}
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            </article>
          ) : null}
        </div>
      </div>
    </RealWorkspaceShell>
  );
}
