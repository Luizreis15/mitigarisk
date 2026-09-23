import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { messages } from '@/lib/i18n/messages';
import { createServerSupabaseClient } from '@/lib/supabase/session';

export default async function UpdatePasswordPage() {
  const cookieStore = await cookies();
  const passwordAction = cookieStore.get('mitiga-password-action')?.value;
  if (passwordAction !== 'recovery' && passwordAction !== 'invite') {
    redirect('/auth/error?reason=missing_action');
  }

  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect('/auth/error?reason=missing_session');

  return (
    <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-canvas)] px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <CardTitle>{messages.passwordUpdate.title}</CardTitle>
          <CardDescription>{messages.passwordUpdate.intro}</CardDescription>
        </CardHeader>
        <CardContent><UpdatePasswordForm /></CardContent>
      </Card>
    </main>
  );
}
