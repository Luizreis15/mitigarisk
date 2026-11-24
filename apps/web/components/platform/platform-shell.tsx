'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { FlaskConicalIcon, LayoutDashboardIcon, LogOutIcon, PlusIcon, ShieldCheckIcon } from 'lucide-react';

import { NavProgress } from '@/components/workspace/nav-progress';

import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/auth-actions';
import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

const t = messages.platform;

const NAV = [
  { href: '/platform', label: t.nav.overview, icon: LayoutDashboardIcon, match: (p: string) => p === '/platform' || p.startsWith('/platform/tenants') },
  { href: '/platform/new', label: t.nav.newTenant, icon: PlusIcon, match: (p: string) => p === '/platform/new' },
];

export function PlatformShell({ signedInEmail, children }: { signedInEmail: string | null; children: ReactNode }) {
  const pathname = usePathname() || '/platform';

  return (
    <div className="min-h-screen bg-[image:var(--gradient-canvas)] text-foreground">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="hidden min-h-screen flex-col bg-[image:var(--gradient-shell)] text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
          <div className="flex h-[var(--topbar-height)] items-center border-b border-white/10 px-5">
            <Link href="/platform" aria-label={messages.brand}>
              <MitigaMark className="text-white" />
            </Link>
          </div>
          <nav aria-label={t.navLabel} className="flex-1 space-y-1 px-3 py-4">
            <p className="px-2 pb-2 text-[0.65rem] font-semibold tracking-[0.12em] text-white/50 uppercase">{t.badge}</p>
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                    active ? 'bg-white/12 text-white shadow-[inset_2px_0_0_0_#5fc1b8]' : 'text-white/65 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-1 border-t border-white/10 bg-black/10 px-5 py-4">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-[0.12em] text-white/60 uppercase">
              <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
              {t.badge}
            </p>
            {signedInEmail ? <p className="truncate text-xs text-white/55">{signedInEmail}</p> : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex min-h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--color-bg-surface)_88%,transparent)] px-4 backdrop-blur-md sm:px-6">
            <div className="lg:hidden">
              <MitigaMark compact />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.7rem] font-medium text-muted-foreground">{t.badge}</p>
              <nav aria-label={t.navLabel} className="flex gap-3 text-sm lg:hidden">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className={cn(item.match(pathname) ? 'font-medium' : 'text-muted-foreground')}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--mitiga-warning)_40%,transparent)] bg-[var(--mitiga-risk-medium-bg)] px-2.5 py-1 text-[0.7rem] font-medium text-[var(--mitiga-risk-medium-fg)] sm:inline-flex">
              <FlaskConicalIcon className="size-3" aria-hidden="true" />
              {messages.realShell.testEnvironment}
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="h-10 gap-2">
                <LogOutIcon className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{messages.workspace.signOut}</span>
              </Button>
            </form>
          </header>
          <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[var(--content-max-width)] space-y-7">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
