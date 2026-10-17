import type { ReactNode } from 'react';
import Link from 'next/link';
import { messages } from '@/lib/i18n/messages';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftIcon } from 'lucide-react';
import { RealWorkspaceShell } from '@/components/workspace/real-workspace-shell';

/** Shared frame for real workspace pages — always inside the SaaS shell. */
export function WorkspaceRealFrame({
  title,
  intro,
  children,
  backHref = '/workspace',
  backLabel = messages.supplierWorkspace.backToWorkspace,
  kicker = messages.supplierWorkspace.kicker,
  fictionalNotice = messages.supplierWorkspace.fictionalNotice,
  tenantName = null,
  signedInEmail = null,
  tenantId = null,
  showSupplierNav = true,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  kicker?: string;
  fictionalNotice?: string;
  tenantName?: string | null;
  signedInEmail?: string | null;
  tenantId?: string | null;
  showSupplierNav?: boolean;
}) {
  return (
    <RealWorkspaceShell
      tenantName={tenantName}
      signedInEmail={signedInEmail}
      tenantId={tenantId}
      showSupplierNav={showSupplierNav}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>

        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.7rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              {kicker}
            </p>
            <Badge variant="outline" className="bg-card">
              {fictionalNotice}
            </Badge>
          </div>
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {intro}
          </p>
        </header>

        <div className="space-y-6">{children}</div>
      </div>
    </RealWorkspaceShell>
  );
}
