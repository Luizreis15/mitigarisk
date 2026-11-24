import { redirect } from 'next/navigation';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { hasCapability } from '@/lib/supabase/authorization';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import type { TenantId } from '@/lib/domain/ids';
import { CustomerImportForm } from '@/components/workspace/customer-import-form';
import { WorkspaceRealFrame } from '@/components/workspace/workspace-real-frame';
import { messages } from '@/lib/i18n/messages';

// Bulk customer import route. Requires customer.manage: a caller without it
// (for example an auditor) is sent back to the list, which offers no create
// control. importCustomersAction re-checks the same capability on submit.
export default async function ImportCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  if (!hasPublicSupabaseConfig()) {
    redirect('/workspace');
  }

  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) {
    redirect('/workspace');
  }

  const client = await createServerSupabaseClient();
  const rawTenant = (await searchParams).tenant;
  const requestedTenantId = rawTenant ? (rawTenant as TenantId) : null;

  let tenantId: TenantId;
  let tenantName: string | null = null;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'customer.view');
    tenantId = context.tenantId;
    tenantName =
      context.memberships.find((m) => m.tenantId === context.tenantId)?.tenantName ?? null;
  } catch {
    redirect('/workspace');
  }

  if (!(await hasCapability(client, tenantId, 'customer.manage'))) {
    redirect(`/workspace/customers?tenant=${tenantId}`);
  }

  const { data: userData } = await client.auth.getUser();
  const signedInEmail = userData.user?.email ?? null;
  const t = messages.customerWorkspace;
  const listHref = `/workspace/customers?tenant=${tenantId}`;

  return (
    <WorkspaceRealFrame
      title={t.importTitle}
      intro={t.importIntro}
      kicker={t.kicker}
      fictionalNotice={t.fictionalNotice}
      backHref={listHref}
      backLabel={t.backToCustomers}
      tenantId={tenantId}
      tenantName={tenantName}
      signedInEmail={signedInEmail}
    >
      <CustomerImportForm tenantId={tenantId} listHref={listHref} />
    </WorkspaceRealFrame>
  );
}
