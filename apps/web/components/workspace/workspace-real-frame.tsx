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
  // A back link only makes sense below the top level (the sidebar covers the rest).
  const showBack = !/^\/workspace(\?|$)/.test(backHref);
  // Kept in the signature for callers; the shell shows the environment once.
  void kicker;
  void fictionalNotice;

  return (
    <RealWorkspaceShell
      tenantName={tenantName}
      signedInEmail={signedInEmail}
      tenantId={tenantId}
      showSupplierNav={showSupplierNav}
    >
      <div className="flex w-full flex-col gap-6">
        <header className="space-y-2">
          {showBack ? (
            <Link
              href={backHref}
              className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
            >
              <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
              {backLabel}
            </Link>
          ) : null}
          <h1 className="max-w-3xl text-[1.75rem] leading-tight font-semibold text-foreground sm:text-[2rem]">{title}</h1>
          {intro ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{intro}</p> : null}
        </header>

        <div className="space-y-6">{children}</div>
      </div>
    </RealWorkspaceShell>
  );
}
