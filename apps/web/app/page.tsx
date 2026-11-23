import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { messages } from '@/lib/i18n/messages';
import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { ConfigMissingNotice } from '@/components/auth/config-missing-notice';
import { SignInForm } from '@/components/auth/sign-in-form';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { cookies } from 'next/headers';
import { DemoRoleSwitcher } from '@/components/auth/demo-role-switcher';
import {
  DEMO_ACCESS_COOKIE,
  DEMO_ROLES,
  isDemoAccessCookieValid,
  isDemoSwitcherEnabled,
} from '@/lib/demo-switcher';

// Server Component: whether the real sign-in form or the "not configured"
// state renders is decided here, server-side, from process.env — never in
// client code (docs/tasks/TASK-015-claude-real-auth-route-integration.md,
// "absence of privileged configuration in client code"). The interactive
// form itself is the separate client component SignInForm.
export default async function LoginPage() {
  const configured = hasPublicSupabaseConfig();
  // Test-environment role switcher (lib/demo-switcher.ts): rendered only
  // when the server enables it; unlocked only by a valid access cookie.
  const demoEnabled = configured && isDemoSwitcherEnabled();
  const demoUnlocked =
    demoEnabled && (await isDemoAccessCookieValid((await cookies()).get(DEMO_ACCESS_COOKIE)?.value));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[image:var(--gradient-canvas)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[42%] bg-[image:var(--gradient-shell)] lg:block"
      />
      <div className="relative mx-auto grid min-h-screen max-w-[90rem] lg:grid-cols-[minmax(18rem,2fr)_minmax(22rem,3fr)]">
        <section className="hidden flex-col justify-between px-10 py-12 text-white lg:flex">
          <MitigaMark className="text-white" />
          <div className="max-w-md space-y-4">
            <p className="text-[0.7rem] tracking-[0.14em] uppercase text-white/70">
              {messages.login.kicker}
            </p>
            <h1 className="text-[2rem] leading-[1.2] font-semibold">
              {messages.login.headline}
            </h1>
            <p className="text-sm leading-6 text-white/80">{messages.login.intro}</p>
          </div>
          <p className="text-xs text-white/55">{messages.login.footer}</p>
        </section>

        <section className="flex items-center px-4 py-10 sm:px-8">
          <Card className="mx-auto w-full max-w-md shadow-[var(--shadow-sm)] ring-border">
            <CardHeader className="space-y-3">
              <div className="lg:hidden">
                <MitigaMark />
              </div>
              <CardTitle className="text-[1.375rem] leading-[1.3]">
                {messages.login.title}
              </CardTitle>
              <CardDescription>{messages.login.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {configured ? (
                <SignInForm />
              ) : (
                <ConfigMissingNotice
                  title={messages.login.configMissingTitle}
                  body={messages.login.configMissingBody}
                />
              )}
              {demoEnabled ? <DemoRoleSwitcher unlocked={demoUnlocked} roles={DEMO_ROLES} /> : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
