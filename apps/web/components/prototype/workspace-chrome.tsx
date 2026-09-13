import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { currentTenant, presentation } from '@/lib/demo/data';
import { interpolate, messages } from '@/lib/i18n/messages';
import { MitigaMark } from '@/components/prototype/mitiga-mark';

export function WorkspaceChrome({
  children,
  eyebrow,
}: {
  children: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen bg-[image:var(--gradient-canvas)] text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        {messages.nav.skipToContent}
      </a>
      <header className="sticky top-0 z-30 flex min-h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--color-bg-surface)_88%,transparent)] px-4 backdrop-blur-md sm:px-6">
        <Link href="/tenants" className="rounded-md">
          <MitigaMark />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {eyebrow ?? currentTenant.environment}
          </p>
        </div>
        <Button variant="outline" className="min-h-11" render={<Link href="/tenants" />}>
          {messages.nav.workspaces}
        </Button>
        <Button variant="ghost" className="min-h-11" render={<Link href="/" />}>
          {messages.nav.signOut}
        </Button>
      </header>
      <div className="border-b border-border bg-[#eef4f2] px-4 py-2 text-sm text-[#3d4d57] sm:px-6">
        {messages.prototype.notice}
        <span className="mt-1 block text-xs">
          {interpolate(messages.presentation.summary, {
            timeZone: presentation.timeZone,
            currency: presentation.currency,
            locale: presentation.locale,
          })}
        </span>
      </div>
      <main
        id="main-content"
        className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-6 sm:px-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}
