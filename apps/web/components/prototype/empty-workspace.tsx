import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { InboxIcon, LayoutDashboardIcon, ShieldOffIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { DemoRole } from '@/lib/demo/types';
import { messages } from '@/lib/i18n/messages';

const copy: Record<
  DemoRole,
  { title: string; body: string; icon: LucideIcon }
> = {
  company: {
    title: messages.emptyWorkspace.companyTitle,
    body: messages.emptyWorkspace.companyBody,
    icon: LayoutDashboardIcon,
  },
  operator: {
    title: messages.emptyWorkspace.operatorTitle,
    body: messages.emptyWorkspace.operatorBody,
    icon: InboxIcon,
  },
  'super-admin': {
    title: messages.emptyWorkspace.adminTitle,
    body: messages.emptyWorkspace.adminBody,
    icon: ShieldOffIcon,
  },
};

export function EmptyWorkspace({ view }: { view: DemoRole }) {
  const content = copy[view];
  const Icon = content.icon;

  return (
    <Empty className="min-h-[22rem] border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{content.title}</EmptyTitle>
        <EmptyDescription>{content.body}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {view === 'company' ? (
            <Button className="h-11" render={<Link href="/onboarding" />}>
              {messages.emptyWorkspace.ctaOnboarding}
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-11"
            render={<Link href="/tenants" />}
          >
            {messages.emptyWorkspace.ctaWorkspaces}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
