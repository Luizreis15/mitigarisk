import Link from 'next/link';

import { WorkspaceDemoPreview } from '@/components/workspace/workspace-demo-preview';
import { WorkspaceFrame } from '@/components/workspace/workspace-frame';
import { WorkspaceRealEntry } from '@/components/workspace/workspace-real-entry';
import { WorkspaceSessionActions } from '@/components/workspace/workspace-session-actions';
import { WorkspaceStatus } from '@/components/workspace/workspace-status';
import { WorkspaceTenantSelection } from '@/components/workspace/workspace-tenant-selection';
import type { WorkspaceViewModel } from '@/lib/domain/workspace-access';
import type { TenantId } from '@/lib/domain/ids';
import { messages } from '@/lib/i18n/messages';

export function WorkspaceExperience({
  model,
  realEntryTenantId,
}: {
  model: WorkspaceViewModel;
  /** Set only for a fully server-verified active tenant selection (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md). Renders the one link into the real supplier evaluation slice; omitted, this component's behavior is unchanged from TASK-015/018/019. */
  realEntryTenantId?: TenantId | null;
}) {
  return (
    <WorkspaceFrame model={model}>
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
      {model.kind !== 'config_unavailable' ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {messages.workspace.tenantContextUnavailable}
        </p>
      ) : null}
      {model.kind !== 'config_unavailable' && model.kind !== 'read_failure' ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {messages.workspace.buildingNotice}
        </p>
      ) : null}
      {realEntryTenantId ? <WorkspaceRealEntry tenantId={realEntryTenantId} /> : null}
      <WorkspaceDemoPreview />
      <WorkspaceSessionActions
        showsAuthenticatedSession={model.showsAuthenticatedSession}
      />
    </WorkspaceFrame>
  );
}
