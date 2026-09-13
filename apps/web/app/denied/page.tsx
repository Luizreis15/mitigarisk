'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ShieldOffIcon } from 'lucide-react';
import { WorkspaceChrome } from '@/components/prototype/workspace-chrome';
import { interpolate, messages } from '@/lib/i18n/messages';
import type { Capability } from '@/lib/demo/types';

function isCapability(value: string | null): value is Capability {
  return (
    value === 'company.view' ||
    value === 'company.evaluate' ||
    value === 'operator.queue' ||
    value === 'platform.admin'
  );
}

function DeniedContent() {
  const params = useSearchParams();
  const requested = params.get('capability');
  const capabilityLabel = isCapability(requested)
    ? messages.session.capability[requested]
    : messages.denied.unknown;

  return (
    <Empty className="min-h-[24rem] border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldOffIcon />
        </EmptyMedia>
        <EmptyTitle>{messages.denied.title}</EmptyTitle>
        <EmptyDescription>
          {interpolate(messages.denied.intro, { capability: capabilityLabel })}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="text-sm text-muted-foreground">{messages.denied.hint}</p>
        <Button className="h-11" render={<Link href="/tenants" />}>
          {messages.denied.back}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export default function DeniedPage() {
  return (
    <WorkspaceChrome eyebrow={messages.denied.kicker}>
      <Suspense>
        <DeniedContent />
      </Suspense>
    </WorkspaceChrome>
  );
}
