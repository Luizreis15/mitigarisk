import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { messages } from '@/lib/i18n/messages';
import type { TenantId } from '@/lib/domain/ids';

// The one link connecting the real, authenticated /workspace landing page
// to the real supplier evaluation slice
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md, "Connect
// the real authenticated /workspace to a minimal supplier list..."). Kept
// separate from WorkspaceExperience/WorkspaceViewModel (TASK-015/019) so
// this task does not have to reshape that existing presentation contract:
// the tenantId here comes directly from the same server-verified tenant
// context /workspace already resolved for itself.
export function WorkspaceRealEntry({ tenantId }: { tenantId: TenantId }) {
  return (
    <section aria-labelledby="workspace-real-entry" className="space-y-2 rounded-xl border border-border p-4">
      <h2 id="workspace-real-entry" className="text-sm font-medium tracking-[0.04em] text-muted-foreground uppercase">
        {messages.supplierWorkspace.listTitle}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">{messages.supplierWorkspace.listIntro}</p>
      <Button
        className="h-11 w-full sm:w-auto"
        render={<Link href={`/workspace/suppliers?tenant=${tenantId}`} />}
      >
        {messages.supplierWorkspace.open} {messages.supplierWorkspace.listTitle}
      </Button>
    </section>
  );
}
