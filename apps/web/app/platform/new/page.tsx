import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PlatformShell } from '@/components/platform/platform-shell';
import { CreateTenantForm } from '@/components/platform/platform-forms';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { messages } from '@/lib/i18n/messages';

const t = messages.platform;

export default async function NewTenantPage() {
  if (!hasPublicSupabaseConfig()) redirect('/');
  const identity = await requireAuthenticatedIdentity();
  if (!identity.isPlatformAdmin) redirect('/workspace');
  const client = await createServerSupabaseClient();
  const { data: userData } = await client.auth.getUser();

  return (
    <PlatformShell signedInEmail={userData.user?.email ?? null}>
      <div className="max-w-xl space-y-5">
        <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">← {t.backToOverview}</Link>
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.newTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.newSubtitle}</p>
        </header>
        <CreateTenantForm />
      </div>
    </PlatformShell>
  );
}
