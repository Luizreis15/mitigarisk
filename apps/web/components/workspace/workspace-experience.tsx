import { WorkspaceDemoPreview } from '@/components/workspace/workspace-demo-preview';
import { WorkspaceFrame } from '@/components/workspace/workspace-frame';
import { WorkspaceSessionActions } from '@/components/workspace/workspace-session-actions';
import { WorkspaceStatus } from '@/components/workspace/workspace-status';
import { WorkspaceTenantSelection } from '@/components/workspace/workspace-tenant-selection';
import type { WorkspaceViewModel } from '@/lib/domain/workspace-access';
import { messages } from '@/lib/i18n/messages';

export function WorkspaceExperience({ model }: { model: WorkspaceViewModel }) {
  return (
    <WorkspaceFrame model={model}>
      <WorkspaceStatus model={model} />
      {model.kind === 'tenant_selection_required' ? (
        <WorkspaceTenantSelection options={model.tenantOptions} />
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
      <WorkspaceDemoPreview />
      <WorkspaceSessionActions
        showsAuthenticatedSession={model.showsAuthenticatedSession}
      />
    </WorkspaceFrame>
  );
}
