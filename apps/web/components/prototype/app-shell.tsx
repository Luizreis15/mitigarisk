'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import {
  ActivityIcon,
  BellIcon,
  Building2Icon,
  ClipboardListIcon,
  FilterIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { currentTenant, presentation } from '@/lib/demo/data';
import { roleLabels, rolePaths } from '@/lib/demo/labels';
import type { Capability, DemoRole } from '@/lib/demo/types';
import { interpolate, messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';
import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navigation: Record<DemoRole, NavItem[]> = {
  company: [
    { id: 'overview', label: messages.nav.overview, icon: LayoutDashboardIcon },
    { id: 'evaluations', label: messages.nav.evaluations, icon: ClipboardListIcon },
    { id: 'alerts', label: messages.nav.alerts, icon: BellIcon },
    { id: 'cases', label: messages.nav.cases, icon: InboxIcon },
  ],
  'super-admin': [
    { id: 'tenants', label: messages.nav.tenants, icon: Building2Icon },
    { id: 'health', label: messages.nav.health, icon: ActivityIcon },
    { id: 'audit', label: messages.nav.audit, icon: ShieldIcon },
  ],
  operator: [
    { id: 'queue', label: messages.nav.queue, icon: InboxIcon },
    { id: 'assigned', label: messages.nav.assigned, icon: UsersIcon },
    { id: 'evidence', label: messages.nav.evidence, icon: ClipboardListIcon },
  ],
};

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function AppShell({
  view,
  children,
  onOpenFilters,
  capabilities,
}: {
  view: DemoRole;
  children: ReactNode;
  onOpenFilters?: () => void;
  capabilities?: Capability[];
}) {
  const items = navigation[view];
  const [query, setQuery] = useState('');
  const notify = usePrototypeFeedback();

  return (
    <div className="min-h-screen bg-[image:var(--gradient-canvas)] text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        {messages.nav.skipToContent}
      </a>

      <div className="lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <aside
          className="sticky top-0 hidden h-screen bg-[image:var(--gradient-shell)] text-sidebar-foreground md:flex md:w-[5.5rem] md:flex-col lg:w-[var(--sidebar-width)]"
          aria-label={messages.nav.primary}
        >
          <div className="flex h-[var(--topbar-height)] items-center border-b border-white/10 px-4 lg:px-5">
            <Link href={rolePaths[view]} className="rounded-md">
              <MitigaMark compact className="lg:hidden" />
              <MitigaMark className="hidden text-white lg:inline-flex" />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm text-white/80 transition-[background-color,color] duration-[var(--duration-fast)] hover:bg-white/10 hover:text-white focus-visible:bg-white/10"
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{item.label}</span>
                <span className="sr-only lg:hidden">{item.label}</span>
              </button>
            ))}
          </nav>
          <p className="hidden px-5 pb-5 text-xs leading-5 text-white/55 lg:block">
            {messages.nav.riskFieldHint}
          </p>
        </aside>

        <div className="flex min-w-0 flex-col pb-24 md:pb-0">
          <header className="sticky top-0 z-30 flex min-h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--color-bg-surface)_88%,transparent)] px-4 backdrop-blur-md sm:px-6">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="md:hidden"
                    aria-label={messages.nav.openMenu}
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
                    {interpolate(messages.nav.sheetNav, {
                      view: roleLabels[view],
                    })}
                  </SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-2">
                  {items.map((item) => (
                    <SheetTrigger
                      key={item.id}
                      render={
                        <button
                          type="button"
                          aria-label={item.label}
                          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm text-white/85"
                          onClick={() => scrollToSection(item.id)}
                        />
                      }
                    >
                      <item.icon className="size-4" aria-hidden="true" />
                      {item.label}
                    </SheetTrigger>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <p className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {currentTenant.name} · {currentTenant.environment}
              </p>
              <p className="truncate text-sm text-foreground">
                {interpolate(messages.nav.viewPolicy, {
                  view: roleLabels[view],
                  policy: currentTenant.policyVersion,
                })}
              </p>
            </div>

            <search className="hidden max-w-sm flex-1 items-center gap-2 md:flex">
            <form
              className="flex w-full items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                notify(
                  messages.search.toastTitle,
                  query
                    ? interpolate(messages.search.toastQuery, { query })
                    : messages.search.toastEmpty,
                );
              }}
            >
              <Label htmlFor={`search-${view}`} className="sr-only">
                {messages.nav.searchLabel}
              </Label>
              <div className="relative w-full">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={`search-${view}`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={messages.nav.searchPlaceholder}
                  className="h-11 bg-card pl-8"
                />
              </div>
            </form>
            </search>

            {onOpenFilters ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 lg:hidden"
                onClick={onOpenFilters}
              >
                <FilterIcon />
                {messages.nav.filters}
              </Button>
            ) : null}

            <RoleSwitcher current={view} capabilities={capabilities} />
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
      </div>

      <nav
        aria-label={messages.nav.mobileRoutes}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur-md md:hidden"
      >
        {items.slice(0, 3).map((item) => (
          <button
            key={item.id}
            type="button"
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.65rem] text-muted-foreground"
            onClick={() => scrollToSection(item.id)}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
        <Link
          href="/"
          className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.65rem] text-muted-foreground"
        >
          <LogOutIcon className="size-4" aria-hidden="true" />
          {messages.nav.signOut}
        </Link>
      </nav>
    </div>
  );
}

function RoleSwitcher({
  current,
  capabilities,
}: {
  current: DemoRole;
  capabilities?: Capability[];
}) {
  const required: Record<DemoRole, Capability> = {
    company: 'company.view',
    operator: 'operator.queue',
    'super-admin': 'platform.admin',
  };
  const roles = (Object.keys(rolePaths) as DemoRole[]).filter(
    (role) =>
      role === current ||
      !capabilities ||
      capabilities.includes(required[role]),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="min-h-11 max-w-[11rem] justify-between" />
        }
      >
        <span className="truncate">{roleLabels[current]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>{messages.nav.switchView}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((role) => (
          <DropdownMenuItem
            key={role}
            render={<Link href={rolePaths[role]} />}
            className={cn(role === current && 'bg-muted')}
          >
            {roleLabels[role]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/tenants" />}>
          {messages.nav.workspaces}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/cases" />}>
          {messages.nav.workbench}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/" />}>
          {messages.nav.backToLogin}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
