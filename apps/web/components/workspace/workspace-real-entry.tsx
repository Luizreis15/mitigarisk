import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { messages } from '@/lib/i18n/messages';
import type { TenantId } from '@/lib/domain/ids';
import { ArrowRightIcon, ClipboardCheckIcon } from 'lucide-react';

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
    <section
      aria-labelledby="workspace-real-entry"
      className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ClipboardCheckIcon aria-hidden="true" className="size-5" />
      </div>
      <h2 id="workspace-real-entry" className="text-lg font-medium">
        {messages.supplierWorkspace.listTitle}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {messages.supplierWorkspace.listIntro}
      </p>
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        {messages.supplierWorkspace.fictionalNotice}
      </p>
      <Button
        className="mt-5 h-11 w-full sm:w-auto"
        render={<Link href={`/workspace/suppliers?tenant=${tenantId}`} />}
      >
        {messages.supplierWorkspace.open} {messages.supplierWorkspace.listTitle}
        <ArrowRightIcon aria-hidden="true" />
      </Button>
    </section>
  );
}
