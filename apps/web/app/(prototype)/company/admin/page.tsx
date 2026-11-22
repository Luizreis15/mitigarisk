'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/prototype/app-shell';
import {
  CompanyAdminLoadingFallback,
  CompanyAdminStateView,
} from '@/components/prototype/company-admin-state';
import {
  northstarAdminMembership,
  northstarCompany,
  parseCompanyAdminState,
} from '@/lib/demo/company-admin';
import { interpolate, messages } from '@/lib/i18n/messages';
import { presentation } from '@/lib/demo/data';

export default function CompanyAdminProfilePage() {
  return (
    <Suspense fallback={<CompanyAdminLoadingFallback />}>
      <CompanyAdminProfileContent />
    </Suspense>
  );
}

function CompanyAdminProfileContent() {
  const params = useSearchParams();
  const state = parseCompanyAdminState(params.get('state'));
  const membership = northstarAdminMembership();
  const capabilities = membership?.capabilities;

  return (
    <AppShell
      view="company-admin"
      capabilities={capabilities}
      workspace={{
        name: northstarCompany.name,
        environment: northstarCompany.environment,
        policyVersion: northstarCompany.policyVersion,
      }}
    >
      <div className="grid gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white shadow-[var(--shadow-sm)]">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.companyAdmin.kicker}
          </p>
          <h1 className="mt-3 text-[2rem] leading-[1.2] font-semibold">
            {northstarCompany.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            {messages.companyAdmin.profileIntro}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              className="h-11 bg-white text-[#203442] hover:bg-white/90"
              render={<Link href="/company/admin/members" />}
            >
              {messages.companyAdmin.membersTitle}
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href="/company" />}
            >
              {messages.companyAdmin.backToCompany}
            </Button>
          </div>
        </section>

        {state === 'ready' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
                  {messages.companyAdmin.identity}
                </p>
                <CardTitle>{messages.companyAdmin.profileTitle}</CardTitle>
                <CardDescription>{northstarCompany.name}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <ProfileRow
                  label={messages.companyAdmin.tenantId}
                  value={northstarCompany.tenantId}
                />
                <ProfileRow
                  label={messages.companyAdmin.tenantSlug}
                  value={northstarCompany.slug}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {messages.companyAdmin.companyStatus}
                  </span>
                  <Badge variant="outline">
                    {messages.companyAdmin.companyStatusActive}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
                  {messages.companyAdmin.tenantScope}
                </p>
                <CardTitle>{northstarCompany.environment}</CardTitle>
                <CardDescription>
                  {interpolate(messages.presentation.summary, {
                    timeZone: presentation.timeZone,
                    currency: presentation.currency,
                    locale: presentation.locale,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <ProfileRow
                  label={messages.companyAdmin.environment}
                  value={northstarCompany.environment}
                />
                <ProfileRow
                  label={messages.companyAdmin.plan}
                  value={northstarCompany.plan}
                />
                <ProfileRow
                  label={messages.companyAdmin.policyVersion}
                  value={northstarCompany.policyVersion}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <CompanyAdminStateView state={state} retryHref="/company/admin" />
        )}
      </div>
    </AppShell>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
