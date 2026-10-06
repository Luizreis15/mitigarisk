import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { messages } from '@/lib/i18n/messages';
import type { TenantId } from '@/lib/domain/ids';
import { ArrowRightIcon, UsersIcon } from 'lucide-react';

// Workspace entry for the customer CRA experience. Rendered only when the
// server has already confirmed customer.view for this verified tenant.
export function WorkspaceCustomerEntry({ tenantId }: { tenantId: TenantId }) {
  const t = messages.customerWorkspace;
  return (
    <section
      aria-labelledby="workspace-customer-entry"
      className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UsersIcon aria-hidden="true" className="size-5" />
      </div>
      <h2 id="workspace-customer-entry" className="text-lg font-medium">
        {t.entryTitle}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {t.entryBody}
      </p>
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        {t.fictionalNotice}
      </p>
      <Button
        className="mt-5 h-11 w-full sm:w-auto"
        render={<Link href={`/workspace/customers?tenant=${tenantId}`} />}
      >
        {t.entryAction}
        <ArrowRightIcon aria-hidden="true" />
      </Button>
    </section>
  );
}
