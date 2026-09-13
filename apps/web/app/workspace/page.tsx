import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { messages, interpolate } from '@/lib/i18n/messages';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { describeWorkspaceAccess } from '@/lib/domain/workspace-access';
import { signOutAction } from '@/app/auth-actions';

// The one real, server-protected product route this task adds
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md, acceptance
// criterion 2). requireAuthenticatedIdentity() fails closed (redirects to
// `/`) before anything below runs. This page never shows the fixture
// prototype data reachable from the sign-in screen's separate "Continue
// with sample data" entry — mixing the two would risk presenting fictional
// tenants/actors as if they belonged to a real, authenticated account.
export default async function WorkspacePage() {
  const identity = await requireAuthenticatedIdentity();
  const client = await createServerSupabaseClient();

  let activeMembershipCount = 0;
  if (!identity.isPlatformAdmin) {
    const { data } = await client
      .from('memberships')
      .select('id')
      .eq('user_id', identity.userId)
      .eq('status', 'active');
    activeMembershipCount = data?.length ?? 0;
  }

  const { data: userData } = await client.auth.getUser();
  const email = userData.user?.email ?? null;
  const access = describeWorkspaceAccess({
    isPlatformAdmin: identity.isPlatformAdmin,
    activeMembershipCount,
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-canvas)] px-4 py-10">
      <Card className="mx-auto w-full max-w-lg shadow-[var(--shadow-sm)] ring-border">
        <CardHeader className="space-y-3">
          <MitigaMark />
          <p className="text-[0.7rem] tracking-[0.14em] uppercase text-muted-foreground">
            {messages.workspace.kicker}
          </p>
          <CardTitle className="text-[1.375rem] leading-[1.3]">{messages.workspace.title}</CardTitle>
          <CardDescription>
            {email ? interpolate(messages.workspace.signedInAs, { email }) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {access === 'platform_admin' ? (
            <Alert>
              <AlertTitle>{messages.workspace.platformAdminNotice}</AlertTitle>
            </Alert>
          ) : access === 'active_member' ? (
            <Alert>
              <AlertTitle>
                {interpolate(messages.workspace.membershipCountLabel, {
                  count: activeMembershipCount,
                })}
              </AlertTitle>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>{messages.workspace.noMembershipTitle}</AlertTitle>
              <AlertDescription>{messages.workspace.noMembershipBody}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground">{messages.workspace.buildingNotice}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" render={<Link href="/tenants" />}>
              {messages.workspace.demoPreviewLink}
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost">
                {messages.workspace.signOut}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
