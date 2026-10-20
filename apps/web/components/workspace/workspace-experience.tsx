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
import { WorkspaceDashboard } from '@/components/workspace/workspace-dashboard';
import type { AuditEventRow } from '@/lib/domain/audit-event';
import type { CompanyDashboardSnapshot } from '@/lib/domain/workspace-dashboard';
import type { WorkspaceViewModel } from '@/lib/domain/workspace-access';
import type { TenantId, UserId } from '@/lib/domain/ids';
import { interpolate, messages } from '@/lib/i18n/messages';

export function WorkspaceExperience({
  model,
  realEntryTenantId,
  customerEntryTenantId,
  accessEntryTenantId,
  dashboardSnapshot = null,
  dashboardUnavailable = false,
  recentEvents = [],
  canViewAudit = false,
  currentUserId = null,
}: {
  model: WorkspaceViewModel;
  realEntryTenantId?: TenantId | null;
  customerEntryTenantId?: TenantId | null;
  accessEntryTenantId?: TenantId | null;
  dashboardSnapshot?: CompanyDashboardSnapshot | null;
  dashboardUnavailable?: boolean;
  recentEvents?: AuditEventRow[];
  canViewAudit?: boolean;
  currentUserId?: UserId | null;
}) {
  const hub = messages.realShell.hub;
  const isActiveMember = model.kind === 'active_member';
  const tenantId =
    customerEntryTenantId ?? realEntryTenantId ?? accessEntryTenantId ?? null;

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

  const customersHref = customerEntryTenantId
    ? `/workspace/customers?tenant=${customerEntryTenantId}`
    : null;
  const showDashboard = Boolean(customerEntryTenantId) || dashboardUnavailable;

  return (
    <RealWorkspaceShell
      tenantName={model.selectedTenantName}
      signedInEmail={model.signedInEmail}
      tenantId={tenantId}
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {hub.title}
            </h1>
            <p className="text-sm text-muted-foreground">{hub.subtitle}</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--mitiga-mineral-600)_35%,transparent)] bg-[var(--mitiga-mineral-100)] px-3 py-1 text-[0.7rem] font-semibold tracking-[0.08em] text-[var(--mitiga-petrol-800)] uppercase">
            {hub.demoNote}
          </span>
        </header>

        {showDashboard ? (
          <WorkspaceDashboard
            snapshot={dashboardSnapshot}
            snapshotUnavailable={dashboardUnavailable || !dashboardSnapshot}
            recentEvents={recentEvents}
            canViewAudit={canViewAudit}
            currentUserId={currentUserId}
            customersHref={customersHref}
          />
        ) : null}

        <section aria-label={hub.modulesTitle} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {hub.modulesTitle}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customerEntryTenantId ? (
              <Link
                href={`/workspace/customers?tenant=${customerEntryTenantId}`}
                className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--mitiga-mineral-600)] hover:bg-[var(--mitiga-mineral-100)]/40"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[image:var(--gradient-risk-low)] text-[var(--mitiga-risk-low-fg)]">
                  <UsersIcon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    {hub.customersTitle}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {hub.customersBody}
                  </span>
                </span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </Link>
            ) : null}

            {realEntryTenantId ? (
              <Link
                href={`/workspace/suppliers?tenant=${realEntryTenantId}`}
                className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--mitiga-petrol-700)] hover:bg-[var(--mitiga-risk-neutral-bg)]/50"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[image:var(--gradient-risk-neutral)] text-[var(--mitiga-risk-neutral-fg)]">
                  <ClipboardCheckIcon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    {hub.suppliersTitle}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {hub.suppliersBody}
                  </span>
                </span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </Link>
            ) : null}

            {accessEntryTenantId ? (
              <Link
                href={`/workspace/access?tenant=${accessEntryTenantId}`}
                className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--mitiga-violet-500)] hover:bg-[var(--mitiga-violet-100)]/60"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[var(--mitiga-violet-100)] text-[var(--mitiga-violet-500)]">
                  <ShieldCheckIcon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">{hub.accessTitle}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {hub.accessBody}
                  </span>
                </span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </RealWorkspaceShell>
  );
}
