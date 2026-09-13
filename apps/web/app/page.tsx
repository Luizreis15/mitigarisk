'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { InfoIcon, KeyRoundIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { demoEmail, demoPasswordPlaceholder } from '@/lib/demo/data';
import { roleLabels, rolePaths } from '@/lib/demo/labels';
import type { DemoRole } from '@/lib/demo/types';
import { messages } from '@/lib/i18n/messages';
import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';

export default function LoginPage() {
  const router = useRouter();
  const notify = usePrototypeFeedback();
  const [email, setEmail] = useState(demoEmail);
  const [submitted, setSubmitted] = useState(false);

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
              <Alert className="border-[#c5d4dc] bg-[#e4edf2]">
                <InfoIcon />
                <AlertTitle>{messages.prototype.environmentBanner}</AlertTitle>
                <AlertDescription>{messages.prototype.notice}</AlertDescription>
              </Alert>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubmitted(true);
                  notify(messages.login.toastSessionTitle, messages.login.toastSessionBody);
                  router.push('/tenants');
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">{messages.login.emailLabel}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{messages.login.passwordLabel}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    defaultValue={demoPasswordPlaceholder}
                    className="h-11"
                  />
                </div>
                {submitted ? (
                  <output className="block text-sm text-muted-foreground">
                    {messages.login.submitting}
                  </output>
                ) : null}
                <Button type="submit" className="h-11 w-full">
                  {messages.login.continue}
                </Button>
              </form>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() =>
                    notify(messages.login.toastSsoTitle, messages.login.toastSsoBody)
                  }
                >
                  <KeyRoundIcon />
                  {messages.login.sso}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11"
                  onClick={() =>
                    notify(messages.login.toastRecoverTitle, messages.login.toastRecoverBody)
                  }
                >
                  {messages.login.recover}
                </Button>
              </div>

              <nav
                aria-label={messages.login.shortcutsLabel}
                className="flex flex-wrap gap-3 text-sm"
              >
                <Link className="underline-offset-4 hover:underline" href="/tenants">
                  {messages.nav.workspaces}
                </Link>
                {(Object.keys(rolePaths) as DemoRole[]).map((role) => (
                  <Link
                    key={role}
                    className="underline-offset-4 hover:underline"
                    href={rolePaths[role]}
                  >
                    {roleLabels[role]}
                  </Link>
                ))}
              </nav>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
