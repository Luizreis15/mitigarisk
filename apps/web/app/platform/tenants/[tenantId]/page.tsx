import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PlatformShell } from '@/components/platform/platform-shell';
import { PlatformStatusBadge } from '@/components/platform/platform-status-badge';
import { StatusChangeForm } from '@/components/platform/platform-forms';
import { isUuid } from '@/lib/domain/ids';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { listPlatformTenantMembers, listPlatformTenants } from '@/lib/supabase/platform-repository';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';

const t = messages.platform;

export default async function PlatformTenantPage({ params }: { params: Promise<{ tenantId: string }> }) {
  if (!hasPublicSupabaseConfig()) redirect('/');
  const identity = await requireAuthenticatedIdentity();
  if (!identity.isPlatformAdmin) redirect('/workspace');

  const client = await createServerSupabaseClient();
  const { data: userData } = await client.auth.getUser();
  const signedInEmail = userData.user?.email ?? null;
  const { tenantId } = await params;

  const tenant = isUuid(tenantId) ? (await listPlatformTenants(client)).find((row) => row.tenantId === tenantId) : undefined;
  if (!tenant) {
    return (
      <PlatformShell signedInEmail={signedInEmail}>
        <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">← {t.backToOverview}</Link>
        <h1 className="text-2xl font-semibold">{t.notFoundTitle}</h1>
      </PlatformShell>
    );
  }
  const members = await listPlatformTenantMembers(client, tenant.tenantId);
  const roleLabel = (key: string) => (t.roles as Record<string, string>)[key] ?? key;

  return (
    <PlatformShell signedInEmail={signedInEmail}>
      <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">← {t.backToOverview}</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{interpolate(t.detailSubtitle, { slug: tenant.slug })}</p>
        </div>
        <PlatformStatusBadge status={tenant.status} />
      </header>

      <section aria-labelledby="tenant-status" className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]">
        <h2 id="tenant-status" className="text-sm font-semibold">{t.statusTitle}</h2>
        <p className="text-sm text-muted-foreground">{tenant.status === 'active' ? t.statusActiveHint : t.statusSuspendedHint}</p>
        <StatusChangeForm
          kind="tenant"
          tenantId={tenant.tenantId}
          currentStatus={tenant.status}
          label={tenant.status === 'active' ? t.suspendCompany : t.reactivateCompany}
        />
      </section>

      <section aria-labelledby="tenant-members" className="space-y-3">
        <h2 id="tenant-members" className="text-sm font-semibold">
          {t.membersTitle}
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">{members.length}</span>
        </h2>
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.membershipId} className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-xs)] sm:flex-row sm:items-start">
              <div className="min-w-0 sm:w-72 sm:shrink-0">
                <p className="truncate font-medium">{member.email}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(member.roleKey)}</p>
              </div>
              <div className="sm:w-28 sm:shrink-0">
                <PlatformStatusBadge status={member.status} />
              </div>
              <p className="flex-1 text-xs text-muted-foreground">
                {t.columnsMembers.lastSignIn}: {member.lastSignInAt ? formatDateTime(member.lastSignInAt) : t.neverSignedIn}
              </p>
              {member.status === 'active' || member.status === 'suspended' ? (
                <div className="sm:w-80 sm:shrink-0 sm:text-right">
                  <StatusChangeForm
                    kind="membership"
                    tenantId={tenant.tenantId}
                    membershipId={member.membershipId}
                    currentStatus={member.status}
                    label={member.status === 'active' ? t.suspendMember : t.reactivateMember}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </PlatformShell>
  );
}
