import { redirect } from 'next/navigation';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { hasCapability } from '@/lib/supabase/authorization';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { listCustomers } from '@/lib/supabase/customers-repository';
import { getLatestCustomerAssessment } from '@/lib/supabase/customer-assessments-repository';
import type { TenantId } from '@/lib/domain/ids';
import { CustomerList } from '@/components/workspace/customer-list';
import { WorkspaceRealFrame } from '@/components/workspace/workspace-real-frame';
import { messages } from '@/lib/i18n/messages';

// Real, authenticated tenant-scoped customer list
// (docs/tasks/TASK-035-cursor-customer-assessment-experience.md). Same
// fail-closed gate as /workspace/suppliers: missing config, a platform
// administrator, or a tenant selection without customer.view all redirect
// back to /workspace before any customer data is read.
export default async function CustomersPage({
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

  const { data: userData } = await client.auth.getUser();
  const signedInEmail = userData.user?.email ?? null;

  const [customers, canManageCustomers] = await Promise.all([
    listCustomers(client, tenantId),
    hasCapability(client, tenantId, 'customer.manage'),
  ]);
  // One RLS-scoped read per customer: the repositories have no list-level
  // "latest assessment" read path yet.
  const latest = await Promise.all(
    customers.map((customer) => getLatestCustomerAssessment(client, tenantId, customer.id)),
  );
  const rows = customers.map((customer, index) => ({ customer, latest: latest[index] }));
  const t = messages.customerWorkspace;

  return (
    <WorkspaceRealFrame
      title={t.listTitle}
      intro={t.listIntro}
      kicker={t.kicker}
      fictionalNotice={t.fictionalNotice}
      backLabel={t.backToWorkspace}
      backHref={`/workspace?tenant=${tenantId}`}
      tenantId={tenantId}
      tenantName={tenantName}
      signedInEmail={signedInEmail}
    >
      <CustomerList rows={rows} tenantId={tenantId} canCreate={canManageCustomers} />
    </WorkspaceRealFrame>
  );
}
