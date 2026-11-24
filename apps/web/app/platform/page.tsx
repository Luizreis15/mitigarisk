import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRightIcon, Building2Icon, MailIcon, UserMinusIcon, UsersIcon } from 'lucide-react';

import { PlatformShell } from '@/components/platform/platform-shell';
import { PlatformStatusBadge } from '@/components/platform/platform-status-badge';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import {
  listPlatformEvents,
  listPlatformTenants,
  type PlatformEventRow,
  type PlatformTenantRow,
} from '@/lib/supabase/platform-repository';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDate, formatDateTime } from '@/lib/i18n/presentation';

const t = messages.platform;

function eventDetail(event: PlatformEventRow): string {
  const m = event.metadata;
  const str = (key: string) => (typeof m[key] === 'string' ? (m[key] as string) : '');
  const status = (key: string) => (t.statuses as Record<string, string>)[str(key)] ?? str(key);
  if (event.action === 'platform.tenant_created') return interpolate(t.eventDetail.created, { name: str('tenant_name'), slug: str('slug') });
  if (event.action === 'platform.tenant_status_changed') {
    return interpolate(t.eventDetail.statusChange, { name: str('tenant_name'), from: status('from'), to: status('to') });
  }
  if (event.action === 'platform.membership_status_changed') {
    const role = (t.roles as Record<string, string>)[str('role_key')] ?? str('role_key');
    return interpolate(t.eventDetail.memberChange, { role, from: status('from'), to: status('to') });
  }
  return event.targetType;
}

export default async function PlatformOverviewPage() {
  if (!hasPublicSupabaseConfig()) redirect('/');
  const identity = await requireAuthenticatedIdentity();
  if (!identity.isPlatformAdmin) redirect('/workspace');

  const client = await createServerSupabaseClient();
  const { data: userData } = await client.auth.getUser();
  const [tenants, events] = await Promise.all([
    listPlatformTenants(client),
    listPlatformEvents(client, 15).catch((): PlatformEventRow[] => []),
  ]);

  const sum = (pick: (row: PlatformTenantRow) => number) => tenants.reduce((total, row) => total + pick(row), 0);
  const activeTenants = tenants.filter((row) => row.status === 'active').length;
  const kpis = [
    {
      label: t.kpis.tenants,
      value: tenants.length,
      hint: `${interpolate(t.kpis.activeTenants, { count: String(activeTenants) })} · ${interpolate(t.kpis.suspendedTenants, { count: String(tenants.length - activeTenants) })}`,
      icon: Building2Icon,
    },
    { label: t.kpis.people, value: sum((r) => r.activeMembers), hint: null, icon: UsersIcon },
    { label: t.kpis.invited, value: sum((r) => r.invitedMembers), hint: null, icon: MailIcon },
    { label: t.kpis.suspendedPeople, value: sum((r) => r.suspendedMembers), hint: null, icon: UserMinusIcon },
  ];

  return (
    <PlatformShell signedInEmail={userData.user?.email ?? null}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{t.overviewTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.overviewSubtitle}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[var(--mitiga-petrol-700)] px-2.5 py-1 text-[0.7rem] font-medium text-white">
          {t.badge}
        </span>
      </header>

      <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">{t.boundaryNote}</p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-xs)]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">{kpi.label}</p>
                <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--mitiga-mineral-100)] text-[var(--mitiga-petrol-700)]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{kpi.value}</p>
              {kpi.hint ? <p className="text-xs text-muted-foreground">{kpi.hint}</p> : null}
            </div>
          );
        })}
      </section>

      <section aria-labelledby="platform-tenants" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="platform-tenants" className="text-sm font-semibold">{t.tenantsTitle}</h2>
          <Link href="/platform/new" className="text-sm font-medium text-[var(--mitiga-petrol-700)] hover:underline">
            + {t.nav.newTenant}
          </Link>
        </div>
        {tenants.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">{t.tenantsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {tenants.map((tenant) => (
              <li key={tenant.tenantId}>
                <Link
                  href={`/platform/tenants/${tenant.tenantId}`}
                  className="group flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--mitiga-mineral-600)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 sm:w-64 sm:shrink-0">
                    <p className="truncate font-medium">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">{tenant.slug} · {formatDate(tenant.createdAt)}</p>
                  </div>
                  <div className="sm:w-28 sm:shrink-0">
                    <PlatformStatusBadge status={tenant.status} />
                  </div>
                  <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                    <p className="truncate">{tenant.adminEmails.length > 0 ? tenant.adminEmails.join(', ') : t.noAdmin}</p>
                    <p>
                      {interpolate(t.peopleSummary, {
                        active: String(tenant.activeMembers),
                        invited: String(tenant.invitedMembers),
                        suspended: String(tenant.suspendedMembers),
                      })}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--mitiga-petrol-700)]">
                    {t.open}
                    <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="platform-activity" className="space-y-3">
        <h2 id="platform-activity" className="text-sm font-semibold">{t.activityTitle}</h2>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">{t.activityEmpty}</p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border bg-card">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{(t.events as Record<string, string>)[event.action] ?? event.action}</p>
                  <p className="truncate text-xs text-muted-foreground">{eventDetail(event)}</p>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(event.occurredAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PlatformShell>
  );
}
