import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { hasCapability } from '@/lib/supabase/authorization';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { getSupplierById } from '@/lib/supabase/suppliers-repository';
import { listSupplierEvidence } from '@/lib/supabase/supplier-evidence-repository';
import { getLatestSupplierEvaluation, listEvaluationReasonCodes } from '@/lib/supabase/supplier-evaluations-repository';
import { isUuid, type TenantId } from '@/lib/domain/ids';
import { SupplierSummary } from '@/components/workspace/supplier-summary';
import { SupplierEvidenceList } from '@/components/workspace/supplier-evidence-list';
import { SupplierEvidenceForm } from '@/components/workspace/supplier-evidence-form';
import { SupplierEvaluationPanel } from '@/components/workspace/supplier-evaluation-panel';
import { WorkspaceRealFrame } from '@/components/workspace/workspace-real-frame';
import { messages } from '@/lib/i18n/messages';

// Real supplier detail: evidence registration, evaluation trigger, and the
// persisted result view (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
// acceptance criterion 11 — "reload the page, and read the same persisted
// result"). Every read below goes through the caller's own authenticated,
// RLS-respecting client and the same tenant re-validated on every request;
// a cross-tenant or malformed supplierId reads back null and renders the
// same generic "not found" state a same-tenant missing id would.
export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ supplierId: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  // Same fail-closed order as /workspace itself
  // (docs/tasks/TASK-015-claude-real-auth-route-integration.md): missing
  // public Supabase configuration must render a safe, non-crashing state
  // rather than let requireAuthenticatedIdentity()'s own client
  // construction throw uncaught.
  if (!hasPublicSupabaseConfig()) {
    redirect('/workspace');
  }

  const identity = await requireAuthenticatedIdentity();
  if (identity.isPlatformAdmin) {
    redirect('/workspace');
  }

  const client = await createServerSupabaseClient();
  const { supplierId } = await params;
  const rawTenant = (await searchParams).tenant;
  const requestedTenantId = rawTenant ? (rawTenant as TenantId) : null;

  let tenantId: TenantId;
  try {
    const context = await resolveAuthorizedTenantContext(client, identity, requestedTenantId, 'supplier.view');
    tenantId = context.tenantId;
  } catch {
    redirect('/workspace');
  }

  // A malformed id (not the UUID shape the database column expects) must
  // fail the same generic way a well-formed but missing/cross-tenant id
  // does — never a raw database error surfaced to the browser.
  const supplier = isUuid(supplierId) ? await getSupplierById(client, tenantId, supplierId) : null;
  if (!supplier) {
    return (
      <WorkspaceRealFrame title={messages.supplierWorkspace.missingTitle} intro={messages.supplierWorkspace.missingBody}>
        <></>
      </WorkspaceRealFrame>
    );
  }

  const [evidence, canManageSuppliers, canRunEvaluation, evaluation] = await Promise.all([
    listSupplierEvidence(client, tenantId, supplierId),
    hasCapability(client, tenantId, 'supplier.manage'),
    hasCapability(client, tenantId, 'evaluation.run'),
    getLatestSupplierEvaluation(client, tenantId, supplierId),
  ]);

  const reasonCodes = evaluation ? await listEvaluationReasonCodes(client, tenantId, evaluation.id) : [];
  // A fresh idempotency/correlation id generated on every server render of
  // this page: a double-submit of the same rendered form (before
  // navigation) replays through the same correlation id
  // (public.complete_supplier_evaluation()); a later reload of this page
  // generates a new one, allowing a genuinely new evaluation attempt. Never
  // derived from anything the browser could set itself.
  const correlationId = randomUUID();

  return (
    <WorkspaceRealFrame title={supplier.displayName} intro={messages.supplierWorkspace.detailIntro}>
      <SupplierSummary supplier={supplier} />
      <SupplierEvidenceList evidence={evidence} />
      {canManageSuppliers ? <SupplierEvidenceForm tenantId={tenantId} supplierId={supplierId} /> : null}
      <SupplierEvaluationPanel
        tenantId={tenantId}
        supplierId={supplierId}
        correlationId={correlationId}
        canRunEvaluation={canRunEvaluation}
        evaluation={evaluation}
        reasonCodes={reasonCodes}
      />
    </WorkspaceRealFrame>
  );
}
