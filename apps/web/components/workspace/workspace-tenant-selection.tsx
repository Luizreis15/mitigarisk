import { messages } from '@/lib/i18n/messages';
import type { TenantOptionView } from '@/lib/domain/workspace-access';

// Renders only the server-derived list of the caller's own active tenant
// memberships (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md).
// Each choice is a plain link to /workspace?tenant=<id>: navigating there
// makes a fresh server request that re-verifies the selection server-side
// every time. No role, capability, or other tenant's data is rendered here,
// and no choice is ever persisted client-side.
export function WorkspaceTenantSelection({ options }: { options: TenantOptionView[] }) {
  return (
    <ul className="space-y-2" aria-label={messages.workspace.tenantSelectionTitle}>
      {options.map((option) => (
        <li key={option.tenantId}>
          <a
            href={`/workspace?tenant=${encodeURIComponent(option.tenantId)}`}
            className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            {option.tenantName}
          </a>
        </li>
      ))}
    </ul>
  );
}
