import { redirect } from 'next/navigation';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { hasCapability } from '@/lib/supabase/authorization';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { listSuppliers } from '@/lib/supabase/suppliers-repository';
import type { TenantId } from '@/lib/domain/ids';
import { SupplierList } from '@/components/workspace/supplier-list';
import { SupplierCreateForm } from '@/components/workspace/supplier-create-form';
import { WorkspaceRealFrame } from '@/components/workspace/workspace-real-frame';
import { messages } from '@/lib/i18n/messages';

// Real, authenticated tenant-scoped supplier list + creation entry point
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md). Requires
// an already-resolved `?tenant=` selection, exactly like /workspace itself
// (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md): a platform
// administrator or a caller with no valid tenant selection is redirected
// back to /workspace rather than shown any operational data — this route
// never grants a platform-admin operational bypass.
export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  // Same fail-closed order as /workspace itself
  // (docs/tasks/TASK-015-claude-real-auth-route-integration.md): missing
  // public Supabase configuration must render a safe, non-crashing state
  // rather than let requireAuthenticatedIdentity()'s own client
  // construction throw uncaught. Redirecting to /workspace reuses that
  // page's existing "config unavailable" presentation rather than
  // duplicating it here.
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
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'supplier.view');
    tenantId = context.tenantId;
  } catch {
    redirect('/workspace');
  }

  const [suppliers, canManageSuppliers] = await Promise.all([
    listSuppliers(client, tenantId),
    hasCapability(client, tenantId, 'supplier.manage'),
  ]);

  return (
    <WorkspaceRealFrame title={messages.supplierWorkspace.listTitle} intro={messages.supplierWorkspace.listIntro}>
      <SupplierList suppliers={suppliers} tenantId={tenantId} />
      {canManageSuppliers ? <SupplierCreateForm tenantId={tenantId} /> : null}
    </WorkspaceRealFrame>
  );
}
