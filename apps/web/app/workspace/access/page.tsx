import { redirect } from 'next/navigation';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveAuthorizedTenantContext } from '@/lib/supabase/tenant-context';
import { hasCapability } from '@/lib/supabase/authorization';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import {
  listTenantAuditEvents,
  listTenantMemberships,
} from '@/lib/supabase/access-repository';
import type { TenantId } from '@/lib/domain/ids';
import { AccessMembers } from '@/components/workspace/access-members';
import { AccessAuditTrail } from '@/components/workspace/access-audit-trail';
import { WorkspaceRealFrame } from '@/components/workspace/workspace-real-frame';
import { messages } from '@/lib/i18n/messages';

// Company people + recent audit trail for the Lucimara walkthrough
// (docs/tasks/PLAN-FRONTEND-10-DIAS-APRESENTACAO-LUCIMARA.md, Day 7–8).
// Reads are RLS-scoped; the page never invents memberships or events.
export default async function AccessPage({
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
    const context = await resolveAuthorizedTenantContext(
      client,
      identity,
      requestedTenantId,
      'tenant.view',
    );
    tenantId = context.tenantId;
    tenantName =
      context.memberships.find((m) => m.tenantId === context.tenantId)?.tenantName ?? null;
  } catch {
    redirect('/workspace');
  }

  const { data: userData } = await client.auth.getUser();
  const signedInEmail = userData.user?.email ?? null;
  const t = messages.accessWorkspace;

  const canViewAudit = await hasCapability(client, tenantId, 'audit.view').catch(() => false);
  const [members, events] = await Promise.all([
    listTenantMemberships(client, tenantId),
    canViewAudit ? listTenantAuditEvents(client, tenantId) : Promise.resolve([]),
  ]);

  return (
    <WorkspaceRealFrame
      title={t.listTitle}
      intro={t.listIntro}
      kicker={t.kicker}
      fictionalNotice={t.fictionalNotice}
      backHref={`/workspace?tenant=${tenantId}`}
      backLabel={t.backToWorkspace}
      tenantId={tenantId}
      tenantName={tenantName}
      signedInEmail={signedInEmail}
    >
      <AccessMembers members={members} currentUserId={identity.userId} />
      <AccessAuditTrail
        events={events}
        currentUserId={identity.userId}
        canView={canViewAudit}
      />
    </WorkspaceRealFrame>
  );
}
