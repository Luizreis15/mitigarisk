import Link from 'next/link';

import { WorkspaceSessionActions } from '@/components/workspace/workspace-session-actions';
import { WorkspaceStatus } from '@/components/workspace/workspace-status';
import { WorkspaceTenantSelection } from '@/components/workspace/workspace-tenant-selection';
import { RealWorkspaceShell } from '@/components/workspace/real-workspace-shell';
import { WorkspaceDashboard } from '@/components/workspace/workspace-dashboard';
import { OperatorWorkQueue } from '@/components/workspace/operator-work-queue';
import { DecisionInbox, type DecisionInboxItem } from '@/components/workspace/decision-inbox';
import { PendingInvitations } from '@/components/workspace/pending-invitations';
import type { PendingInvitation } from '@/lib/domain/invitations';
import type { WorkQueue } from '@/lib/domain/work-queue';
import type { WorkspacePersona } from '@/lib/domain/workspace-persona';
import type { PortfolioPoint } from '@/lib/domain/workspace-dashboard';
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
  persona = null,
  workQueue = null,
  decisionInbox = [],
  pendingInvitations = [],
  canManageCustomers = false,
  portfolioPoints = [],
  openTriggers = 0,
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
  persona?: WorkspacePersona | null;
  workQueue?: WorkQueue | null;
  decisionInbox?: DecisionInboxItem[];
  pendingInvitations?: PendingInvitation[];
  portfolioPoints?: PortfolioPoint[];
  openTriggers?: number;
  canManageCustomers?: boolean;
}) {
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
          <PendingInvitations invitations={pendingInvitations} />
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
  const showWorkQueue = persona === 'operator' && Boolean(customerEntryTenantId);
  const title = showWorkQueue ? messages.workQueue.title : messages.overview.title;
  const subtitle = showWorkQueue
    ? messages.workQueue.subtitle
    : interpolate(messages.overview.subtitle, { company: model.selectedTenantName ?? '' });

  return (
    <RealWorkspaceShell
      tenantName={model.selectedTenantName}
      signedInEmail={model.signedInEmail}
      tenantId={tenantId}
      homeContextLabel={showWorkQueue ? messages.workQueue.title : messages.overview.title}
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-[1.75rem] leading-tight font-semibold text-foreground sm:text-[2rem]">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {persona ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-[var(--shadow-xs)]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--mitiga-mineral-600)]" />
              {messages.personas[persona]}
            </span>
          ) : null}
        </header>

        <PendingInvitations invitations={pendingInvitations} />

        {showWorkQueue && customerEntryTenantId ? (
          <OperatorWorkQueue
            queue={workQueue}
            tenantId={customerEntryTenantId}
            canCreate={canManageCustomers}
            unavailable={dashboardUnavailable}
          />
        ) : null}

        {!showWorkQueue && showDashboard ? (
          <WorkspaceDashboard
            snapshot={dashboardSnapshot}
            snapshotUnavailable={dashboardUnavailable || !dashboardSnapshot}
            points={portfolioPoints}
            attention={{ awaitingDecision: decisionInbox.length, openTriggers }}
            recentEvents={recentEvents}
            canViewAudit={canViewAudit}
            currentUserId={currentUserId}
            customersHref={customersHref}
            accessHref={accessEntryTenantId ? `/workspace/access?tenant=${accessEntryTenantId}` : null}
            tenantId={customerEntryTenantId ?? null}
            inbox={customerEntryTenantId ? (
              <DecisionInbox items={decisionInbox} tenantId={customerEntryTenantId} mode={persona === 'mlro' ? 'mlro' : 'analyst'} />
            ) : null}
          />
        ) : null}
      </div>
    </RealWorkspaceShell>
  );
}
