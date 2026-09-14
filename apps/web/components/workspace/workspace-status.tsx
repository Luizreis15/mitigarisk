import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { messages } from '@/lib/i18n/messages';
import { workspaceMembershipCountCopy } from '@/lib/i18n/workspace';
import type { WorkspaceViewModel } from '@/lib/domain/workspace-access';

export function WorkspaceStatus({ model }: { model: WorkspaceViewModel }) {
  if (model.kind === 'config_unavailable') {
    return (
      <Alert variant="destructive" id="workspace-status">
        <AlertTitle>{messages.workspace.configUnavailableTitle}</AlertTitle>
        <AlertDescription>{messages.workspace.configUnavailableBody}</AlertDescription>
      </Alert>
    );
  }

  if (model.kind === 'read_failure') {
    return (
      <Alert variant="destructive" id="workspace-status">
        <AlertTitle>{messages.workspace.readFailureTitle}</AlertTitle>
        <AlertDescription>{messages.workspace.readFailureBody}</AlertDescription>
      </Alert>
    );
  }

  if (model.kind === 'platform_admin') {
    return (
      <Alert id="workspace-status">
        <AlertTitle>{messages.workspace.platformAdminNotice}</AlertTitle>
        <AlertDescription>{messages.workspace.platformAdminBody}</AlertDescription>
      </Alert>
    );
  }

  if (model.kind === 'tenant_selection_required') {
    return (
      <Alert id="workspace-status">
        <AlertTitle>{messages.workspace.tenantSelectionTitle}</AlertTitle>
        <AlertDescription>{messages.workspace.tenantSelectionBody}</AlertDescription>
      </Alert>
    );
  }

  if (model.kind === 'active_member') {
    return (
      <Alert id="workspace-status">
        <AlertTitle>
          {workspaceMembershipCountCopy(
            model.activeMembershipCount,
            model.membershipCountForm,
          )}
        </AlertTitle>
        <AlertDescription>{messages.workspace.membershipBody}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" id="workspace-status">
      <AlertTitle>{messages.workspace.noMembershipTitle}</AlertTitle>
      <AlertDescription>{messages.workspace.noMembershipBody}</AlertDescription>
    </Alert>
  );
}
