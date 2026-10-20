import type { ReactNode } from 'react';
import Link from 'next/link';
import { messages } from '@/lib/i18n/messages';
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
      <div className="mx-auto flex w-full max-w-[var(--content-max-width)] flex-col gap-5">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
          {backLabel}
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[0.65rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {kicker}
            </p>
            <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{intro}</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[0.65rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            {fictionalNotice}
          </span>
        </header>

        <div className="space-y-5">{children}</div>
      </div>
    </RealWorkspaceShell>
  );
}
