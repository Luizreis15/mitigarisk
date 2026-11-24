'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import {
  ChevronDownIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react';

import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { NavProgress } from '@/components/workspace/nav-progress';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { signOutAction } from '@/app/auth-actions';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

export type WorkspaceNavId = 'home' | 'customers' | 'access';

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
    { id: 'home', label: messages.realShell.nav.home, href: `/workspace${q}`, icon: LayoutDashboardIcon, description: messages.realShell.nav.homeHint },
    { id: 'customers', label: messages.realShell.nav.customers, href: `/workspace/customers${q}`, icon: UsersIcon, description: messages.realShell.nav.customersHint },
    { id: 'access', label: messages.realShell.nav.access, href: `/workspace/access${q}`, icon: UsersRoundIcon, description: messages.realShell.nav.accessHint },
  ];
}

function resolveActive(pathname: string): WorkspaceNavId {
  if (pathname.startsWith('/workspace/customers')) return 'customers';
  if (pathname.startsWith('/workspace/access')) return 'access';
  return 'home';
}

function initials(email: string | null): string {
  if (!email) return '·';
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._+-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase();
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : item.description}
      className={cn(
        'group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
        active ? 'bg-white/12 text-white' : 'text-white/65 hover:bg-white/8 hover:text-white',
        collapsed && 'justify-center px-0',
      )}
    >
      {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#5fc1b8]" /> : null}
      <item.icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );
}

export function RealWorkspaceShell({
  tenantName,
  signedInEmail,
  tenantId,
  children,
  homeContextLabel,
}: {
  tenantName: string | null;
  signedInEmail: string | null;
  tenantId: string | null;
  children: ReactNode;
  /** Kept for callers; the supplier module is no longer in the navigation. */
  showSupplierNav?: boolean;
  /** Overrides the topbar label on Home (e.g. the operator's work queue). */
  homeContextLabel?: string;
}) {
  const pathname = usePathname() || '/workspace';
  const active = resolveActive(pathname);
  const nav = buildNav(tenantId);
  const t = messages.realShell;
  const q = tenantId ? `?tenant=${encodeURIComponent(tenantId)}` : '';
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const context =
    active === 'customers' ? t.context.customers : active === 'access' ? t.context.access : (homeContextLabel ?? t.context.home);

  return (
    <div className="min-h-screen bg-[image:var(--gradient-canvas)] text-foreground">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        {t.skipToContent}
      </a>

      <div
        className="md:grid md:grid-cols-[var(--shell-rail)_minmax(0,1fr)] lg:grid-cols-[var(--shell-side)_minmax(0,1fr)] lg:transition-[grid-template-columns] lg:duration-[var(--duration-standard)]"
        style={{ '--shell-rail': '4.25rem', '--shell-side': collapsed ? '4.25rem' : '15.5rem' } as React.CSSProperties}
      >
        <aside className="sticky top-0 hidden h-screen flex-col bg-[image:var(--gradient-shell)] text-sidebar-foreground md:flex" aria-label={t.primaryNav}>
          <div className={cn('flex h-[var(--topbar-height)] items-center border-b border-white/8 px-4', collapsed && 'lg:justify-center lg:px-0', 'max-lg:justify-center max-lg:px-0')}>
            <Link href={nav[0]?.href ?? '/workspace'} className="inline-flex items-center rounded-md text-white" aria-label={messages.brand}>
              <MitigaMark compact className="text-white" />
              <span className={cn('ml-2.5 hidden font-[family-name:var(--font-heading)] text-[0.95rem] font-semibold tracking-[0.16em] uppercase', !collapsed && 'lg:inline')}>
                {messages.brand}
              </span>
            </Link>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-2.5 py-4">
            {tenantId && active !== 'access' ? (
              <Link
                href={`/workspace/customers/new${q}`}
                title={messages.realShell.nav.customersNew}
                className={cn(
                  'mb-4 flex h-10 items-center justify-center gap-2 rounded-md bg-white text-sm font-semibold text-[var(--mitiga-ink-950)] shadow-sm transition-colors hover:bg-[var(--mitiga-mineral-100)]',
                  (collapsed ? 'lg:px-0' : 'lg:px-3'),
                  'max-lg:px-0',
                )}
              >
                <PlusIcon className="size-4" aria-hidden="true" />
                <span className={cn('hidden', !collapsed && 'lg:inline')}>{messages.realShell.nav.customersNew}</span>
              </Link>
            ) : null}
            <p className={cn('mb-1.5 hidden px-3 text-[0.65rem] font-semibold tracking-[0.14em] text-white/40 uppercase', !collapsed && 'lg:block')}>
              {t.navSection}
            </p>
            <nav className="flex flex-col gap-0.5">
              {nav.map((item) => (
                <div key={item.id}>
                  <div className="lg:hidden">
                    <SidebarLink item={item} active={active === item.id} collapsed />
                  </div>
                  <div className="hidden lg:block">
                    <SidebarLink item={item} active={active === item.id} collapsed={collapsed} />
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="border-t border-white/8 p-2.5">
            <div className={cn('mb-2 hidden rounded-md bg-white/6 px-3 py-2.5', !collapsed && 'lg:block')}>
              <p className="text-[0.62rem] font-semibold tracking-[0.14em] text-white/45 uppercase">{t.companyLabel}</p>
              <p className="mt-0.5 truncate text-sm font-medium text-white">{tenantName ?? t.noCompany}</p>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? t.expandSidebar : t.collapseSidebar}
              aria-pressed={collapsed}
              className={cn(
                'hidden h-9 w-full items-center gap-3 rounded-md px-3 text-xs font-medium text-white/55 transition-colors hover:bg-white/8 hover:text-white lg:flex',
                collapsed && 'justify-center px-0',
              )}
            >
              {collapsed ? <PanelLeftOpenIcon className="size-4" aria-hidden="true" /> : <PanelLeftCloseIcon className="size-4" aria-hidden="true" />}
              {!collapsed ? t.collapseSidebar : null}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col pb-20 md:pb-0">
          <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--color-bg-surface)_92%,transparent)] px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <Sheet>
              <SheetTrigger render={<Button variant="ghost" size="icon-lg" className="md:hidden" aria-label={t.openMenu} />}>
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="left" className="bg-[image:var(--gradient-shell)] text-white">
                <SheetHeader>
                  <SheetTitle className="text-white">
                    <MitigaMark className="text-white" />
                  </SheetTitle>
                  <SheetDescription className="text-white/70">{tenantName ?? t.noCompany}</SheetDescription>
                </SheetHeader>
                <nav className="mt-4 flex flex-col gap-1 px-2">
                  {nav.map((item) => (
                    <SheetTrigger
                      key={item.id}
                      render={
                        <Link
                          href={item.href}
                          className={cn(
                            'flex min-h-12 flex-col justify-center rounded-md px-3 py-2 text-left text-sm',
                            active === item.id ? 'bg-white/12 text-white' : 'text-white/85 hover:bg-white/8',
                          )}
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
              <p className="truncate text-[0.7rem] font-medium text-muted-foreground">{tenantName ?? t.noCompany}</p>
              <p className="truncate text-sm font-semibold text-foreground">{context}</p>
            </div>

            <span className="hidden items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--mitiga-warning)_40%,transparent)] bg-[var(--mitiga-risk-medium-bg)] px-2.5 py-1 text-[0.7rem] font-medium text-[var(--mitiga-risk-medium-fg)] sm:inline-flex">
              <FlaskConicalIcon className="size-3" aria-hidden="true" />
              {t.testEnvironment}
            </span>

            <form id="mitiga-signout" action={signOutAction} className="hidden" />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={t.accountMenu}
                    className="flex h-10 items-center gap-2 rounded-full border border-border bg-card py-1 pr-2 pl-1 text-sm transition-colors hover:bg-muted focus-visible:outline-none"
                  />
                }
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-[image:var(--gradient-brand)] text-xs font-semibold text-white">
                  {initials(signedInEmail)}
                </span>
                <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-2">
                  <p className="truncate text-sm font-medium">{signedInEmail ?? '—'}</p>
                  <p className="truncate text-xs text-muted-foreground">{tenantName ?? t.noCompany}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => (document.getElementById('mitiga-signout') as HTMLFormElement | null)?.requestSubmit()}
                >
                  <LogOutIcon aria-hidden="true" />
                  {messages.workspace.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <div id="main-content" className="mx-auto w-full max-w-[var(--content-max-width)] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </div>
        </div>
      </div>

      <nav
        aria-label={t.primaryNav}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[color-mix(in_srgb,var(--color-bg-surface)_96%,transparent)] px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-3 gap-1">
          {nav.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active === item.id ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[0.68rem] font-medium transition-colors',
                  active === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <item.icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
