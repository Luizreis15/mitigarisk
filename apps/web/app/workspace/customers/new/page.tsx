import { redirect } from 'next/navigation';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { hasCapability } from '@/lib/supabase/authorization';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import type { TenantId } from '@/lib/domain/ids';
import { CustomerCreateForm } from '@/components/workspace/customer-create-form';
import { WorkspaceRealFrame } from '@/components/workspace/workspace-real-frame';
import { countryOptions } from '@/lib/i18n/countries';
import { messages } from '@/lib/i18n/messages';

// Customer creation route. Requires customer.manage: a caller without it
// (for example an auditor) is sent back to the list, which offers no create
// control. createCustomerAction re-checks the same capability on submit.
export default async function NewCustomerPage({
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
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'customer.view');
    tenantId = context.tenantId;
  } catch {
    redirect('/workspace');
  }

  if (!(await hasCapability(client, tenantId, 'customer.manage'))) {
    redirect(`/workspace/customers?tenant=${tenantId}`);
  }

  const t = messages.customerWorkspace;
  const listHref = `/workspace/customers?tenant=${tenantId}`;

  return (
    <WorkspaceRealFrame
      title={t.newTitle}
      intro={t.newIntro}
      kicker={t.kicker}
      fictionalNotice={t.fictionalNotice}
      backHref={listHref}
      backLabel={t.backToCustomers}
    >
      <CustomerCreateForm tenantId={tenantId} countries={countryOptions()} cancelHref={listHref} />
    </WorkspaceRealFrame>
  );
}
