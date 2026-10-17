'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Building2Icon,
  ClipboardListIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  UsersIcon,
} from 'lucide-react';

import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { signOutAction } from '@/app/auth-actions';
import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

export type WorkspaceNavId = 'home' | 'customers' | 'suppliers';

type NavItem = {
  id: WorkspaceNavId;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

function buildNav(tenantId: string | null): NavItem[] {
  const q = tenantId ? `?tenant=${encodeURIComponent(tenantId)}` : '';
  return [
    {
      id: 'home',
      label: messages.realShell.nav.home,
      href: `/workspace${q}`,
      icon: HomeIcon,
      description: messages.realShell.nav.homeHint,
    },
    {
      id: 'customers',
      label: messages.realShell.nav.customers,
      href: `/workspace/customers${q}`,
      icon: UsersIcon,
      description: messages.realShell.nav.customersHint,
    },
    {
      id: 'suppliers',
      label: messages.realShell.nav.suppliers,
      href: `/workspace/suppliers${q}`,
      icon: ClipboardListIcon,
      description: messages.realShell.nav.suppliersHint,
    },
  ];
}

function resolveActive(pathname: string): WorkspaceNavId {
  if (pathname.startsWith('/workspace/customers')) return 'customers';
  if (pathname.startsWith('/workspace/suppliers')) return 'suppliers';
  return 'home';
}

export function RealWorkspaceShell({
  tenantName,
  signedInEmail,
  tenantId,
  children,
  showSupplierNav = true,
}: {
  tenantName: string | null;
  signedInEmail: string | null;
  tenantId: string | null;
  children: ReactNode;
  showSupplierNav?: boolean;
}) {
  const pathname = usePathname() || '/workspace';
  const active = resolveActive(pathname);
  const nav = buildNav(tenantId).filter((item) => showSupplierNav || item.id !== 'suppliers');
  const t = messages.realShell;

  return (
    <div className="min-h-screen bg-[image:var(--gradient-canvas)] text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        {t.skipToContent}
      </a>

      <div className="lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <aside
          className="sticky top-0 hidden h-screen flex-col bg-[image:var(--gradient-shell)] text-sidebar-foreground md:flex md:w-[5.5rem] lg:w-[var(--sidebar-width)]"
          aria-label={t.primaryNav}
        >
          <div className="flex h-[var(--topbar-height)] items-center border-b border-white/10 px-4 lg:px-5">
            <Link href={nav[0]?.href ?? '/workspace'} className="rounded-md">
              <MitigaMark compact className="lg:hidden text-white" />
              <MitigaMark className="hidden text-white lg:inline-flex" />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {nav.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active === item.id ? 'page' : undefined}
                title={item.description}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm transition-[background-color,color] duration-[var(--duration-fast)]',
                  active === item.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{item.label}</span>
                <span className="sr-only lg:hidden">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="hidden space-y-2 border-t border-white/10 px-5 py-4 lg:block">
            <p className="text-[0.65rem] font-medium tracking-[0.12em] text-white/50 uppercase">
              {t.companyLabel}
            </p>
            <p className="truncate text-sm text-white/90">{tenantName ?? t.noCompany}</p>
            {signedInEmail ? (
              <p className="truncate text-xs text-white/55">{signedInEmail}</p>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col pb-20 md:pb-0">
          <header className="sticky top-0 z-30 flex min-h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--color-bg-surface)_88%,transparent)] px-4 backdrop-blur-md sm:px-6">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="md:hidden"
                    aria-label={t.openMenu}
                  />
                }
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="left" className="bg-[image:var(--gradient-shell)] text-white">
                <SheetHeader>
                  <SheetTitle className="text-white">
                    <MitigaMark className="text-white" />
                  </SheetTitle>
                  <SheetDescription className="text-white/70">
                    {tenantName ?? t.noCompany}
                  </SheetDescription>
                </SheetHeader>
                <nav className="mt-4 flex flex-col gap-1 px-2">
                  {nav.map((item) => (
                    <SheetTrigger
                      key={item.id}
                      render={
                        <Link
                          href={item.href}
                          className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                        />
                      }
                    >
                      <span className="inline-flex items-center gap-3 font-medium">
                        <item.icon className="size-4" aria-hidden="true" />
                        {item.label}
                      </span>
                      <span className="mt-0.5 pl-7 text-xs text-white/55">{item.description}</span>
                    </SheetTrigger>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                <Building2Icon className="size-3.5" aria-hidden="true" />
                {tenantName ?? t.noCompany}
              </p>
              <p className="truncate text-sm text-foreground">
                {active === 'customers'
                  ? t.context.customers
                  : active === 'suppliers'
                    ? t.context.suppliers
                    : t.context.home}
              </p>
            </div>

            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="min-h-11 gap-2">
                <LogOutIcon className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{messages.workspace.signOut}</span>
              </Button>
            </form>
          </header>

          <div id="main-content" className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
