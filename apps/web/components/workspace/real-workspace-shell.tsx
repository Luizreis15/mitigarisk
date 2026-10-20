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
  ShieldCheckIcon,
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

export type WorkspaceNavId = 'home' | 'customers' | 'suppliers' | 'access';

type NavChild = {
  id: string;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

type NavItem = {
  id: WorkspaceNavId;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  children?: NavChild[];
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
      children: tenantId
        ? [
            {
              id: 'customers-all',
              label: messages.realShell.nav.customersAll,
              href: `/workspace/customers${q}`,
              match: (pathname) =>
                pathname === '/workspace/customers' ||
                (pathname.startsWith('/workspace/customers/') &&
                  !pathname.startsWith('/workspace/customers/new')),
            },
            {
              id: 'customers-new',
              label: messages.realShell.nav.customersNew,
              href: `/workspace/customers/new${q}`,
              match: (pathname) => pathname.startsWith('/workspace/customers/new'),
            },
          ]
        : undefined,
    },
    {
      id: 'suppliers',
      label: messages.realShell.nav.suppliers,
      href: `/workspace/suppliers${q}`,
      icon: ClipboardListIcon,
      description: messages.realShell.nav.suppliersHint,
      children: tenantId
        ? [
            {
              id: 'suppliers-all',
              label: messages.realShell.nav.suppliersAll,
              href: `/workspace/suppliers${q}`,
              match: (pathname) => pathname.startsWith('/workspace/suppliers'),
            },
          ]
        : undefined,
    },
    {
      id: 'access',
      label: messages.realShell.nav.access,
      href: `/workspace/access${q}`,
      icon: ShieldCheckIcon,
      description: messages.realShell.nav.accessHint,
      children: tenantId
        ? [
            {
              id: 'access-people',
              label: messages.accessWorkspace.membersTitle,
              href: `/workspace/access${q}`,
              match: (pathname) => pathname.startsWith('/workspace/access'),
            },
          ]
        : undefined,
    },
  ];
}

function resolveActive(pathname: string): WorkspaceNavId {
  if (pathname.startsWith('/workspace/customers')) return 'customers';
  if (pathname.startsWith('/workspace/suppliers')) return 'suppliers';
  if (pathname.startsWith('/workspace/access')) return 'access';
  return 'home';
}

function NavLink({
  item,
  active,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      title={item.description}
      className={cn(
        'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm transition-[background-color,color,box-shadow] duration-[var(--duration-fast)]',
        active
          ? 'bg-white/14 text-white shadow-[inset_3px_0_0_0_var(--mitiga-mineral-100)]'
          : 'text-white/75 hover:bg-white/10 hover:text-white',
        compact && 'justify-center px-0',
      )}
    >
      <item.icon className="size-4 shrink-0" aria-hidden="true" />
      {!compact ? <span className="font-medium">{item.label}</span> : null}
    </Link>
  );
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

      <div className="md:grid md:grid-cols-[var(--sidebar-rail-width)_minmax(0,1fr)] lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <aside
          className="sticky top-0 hidden h-screen flex-col bg-[image:var(--gradient-shell)] text-sidebar-foreground md:flex"
          aria-label={t.primaryNav}
        >
          <div className="flex h-[var(--topbar-height)] items-center border-b border-white/10 px-4 lg:px-5">
            <Link
              href={nav[0]?.href ?? '/workspace'}
              className="inline-flex items-center rounded-md text-white"
              aria-label={messages.brand}
            >
              <MitigaMark compact className="text-white" />
              <span className="ml-2.5 hidden text-[0.85rem] font-semibold tracking-[0.14em] uppercase lg:inline">
                {messages.brand}
              </span>
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            <p className="mb-1 hidden px-3 text-[0.65rem] font-semibold tracking-[0.14em] text-white/45 uppercase lg:block">
              {t.navSection}
            </p>
            <nav className="flex flex-col gap-1">
              {nav.map((item) => {
                const isActive = active === item.id;
                const showChildren = Boolean(item.children?.length) && isActive;
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="lg:hidden">
                      <NavLink item={item} active={isActive} compact />
                    </div>
                    <div className="hidden lg:block">
                      <NavLink item={item} active={isActive} />
                    </div>
                    {showChildren ? (
                      <ul className="hidden space-y-0.5 pb-1 pl-4 lg:block">
                        {item.children!.map((child) => {
                          const childActive = child.match(pathname);
                          return (
                            <li key={child.id}>
                              <Link
                                href={child.href}
                                aria-current={childActive ? 'page' : undefined}
                                className={cn(
                                  'flex min-h-9 items-center rounded-md px-3 text-[0.8rem] transition-colors',
                                  childActive
                                    ? 'bg-white/10 font-medium text-white'
                                    : 'text-white/60 hover:bg-white/8 hover:text-white/90',
                                )}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="hidden space-y-2 border-t border-white/10 bg-black/10 px-5 py-4 lg:block">
            <p className="text-[0.65rem] font-semibold tracking-[0.12em] text-[var(--mitiga-mineral-100)]/80 uppercase">
              {t.companyLabel}
            </p>
            <p className="truncate text-sm font-medium text-white">
              {tenantName ?? t.noCompany}
            </p>
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
                  {nav.map((item) => {
                    const isActive = active === item.id;
                    return (
                      <div key={item.id} className="space-y-1">
                        <SheetTrigger
                          render={
                            <Link
                              href={item.href}
                              className={cn(
                                'flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-left text-sm',
                                isActive ? 'bg-white/14 text-white' : 'text-white/90 hover:bg-white/10',
                              )}
                            />
                          }
                        >
                          <span className="inline-flex items-center gap-3 font-medium">
                            <item.icon className="size-4" aria-hidden="true" />
                            {item.label}
                          </span>
                          <span className="mt-0.5 pl-7 text-xs text-white/55">
                            {item.description}
                          </span>
                        </SheetTrigger>
                        {isActive && item.children?.length ? (
                          <ul className="space-y-0.5 pb-1 pl-7">
                            {item.children.map((child) => (
                              <li key={child.id}>
                                <SheetTrigger
                                  render={
                                    <Link
                                      href={child.href}
                                      className={cn(
                                        'flex min-h-10 items-center rounded-md px-3 text-sm',
                                        child.match(pathname)
                                          ? 'bg-white/10 text-white'
                                          : 'text-white/70 hover:bg-white/8',
                                      )}
                                    />
                                  }
                                >
                                  {child.label}
                                </SheetTrigger>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                <Building2Icon className="size-3.5" aria-hidden="true" />
                {tenantName ?? t.noCompany}
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {active === 'customers'
                  ? t.context.customers
                  : active === 'suppliers'
                    ? t.context.suppliers
                    : active === 'access'
                      ? t.context.access
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

          <div
            id="main-content"
            className="mx-auto w-full max-w-[var(--content-max-width)] flex-1 px-4 py-6 sm:px-6 sm:py-7 lg:px-8"
          >
            {children}
          </div>
        </div>
      </div>

      <nav
        aria-label={t.primaryNav}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[color-mix(in_srgb,var(--color-bg-surface)_94%,transparent)] px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      >
        <ul
          className={cn(
            'mx-auto grid max-w-lg gap-1',
            nav.length >= 4 ? 'grid-cols-4' : 'grid-cols-3',
          )}
        >
          {nav.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active === item.id ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.65rem] font-medium transition-colors',
                  active === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
