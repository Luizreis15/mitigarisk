import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
        <Card className="shadow-[var(--shadow-sm)] ring-border">
          <CardHeader className="space-y-3 border-b bg-muted/20 px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[0.7rem] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                {kicker}
              </p>
              <Badge variant="outline" className="bg-background">
                {fictionalNotice}
              </Badge>
            </div>
            <CardTitle className="max-w-3xl text-2xl leading-tight sm:text-3xl">
              {title}
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 sm:text-base">
              {intro}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 px-5 py-6 sm:px-8 sm:py-8">
            {children}
          </CardContent>
        </Card>
      </div>
    </RealWorkspaceShell>
  );
}
