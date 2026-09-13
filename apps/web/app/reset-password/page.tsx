import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfigMissingNotice } from '@/components/auth/config-missing-notice';
import { PasswordResetForm } from '@/components/auth/password-reset-form';
import { messages } from '@/lib/i18n/messages';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';

export default function ResetPasswordPage() {
  const configured = hasPublicSupabaseConfig();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-canvas)] px-4 py-10">
      <Card className="mx-auto w-full max-w-md shadow-[var(--shadow-sm)] ring-border">
        <CardHeader className="space-y-3">
          <p className="text-[0.7rem] tracking-[0.14em] uppercase text-muted-foreground">
            {messages.passwordReset.kicker}
          </p>
          <CardTitle className="text-[1.375rem] leading-[1.3]">
            {messages.passwordReset.title}
          </CardTitle>
          <CardDescription>{messages.passwordReset.intro}</CardDescription>
        </CardHeader>
        <CardContent>
          {configured ? (
            <PasswordResetForm />
          ) : (
            <ConfigMissingNotice
              title={messages.passwordReset.configMissingTitle}
              body={messages.passwordReset.configMissingBody}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
