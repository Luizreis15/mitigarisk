import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { messages } from '@/lib/i18n/messages';

// Shared frame for the real supplier evaluation workflow's pages
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md). Purely
// presentational: every value it renders is passed in by a Server Component
// that already resolved identity, tenant, and capability server-side.
export function WorkspaceRealFrame({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-10 sm:px-6">
      <Link href="/workspace" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {messages.workspace.title}
      </Link>
      <Card className="shadow-[var(--shadow-sm)] ring-border">
        <CardHeader className="space-y-2">
          <p className="text-[0.7rem] tracking-[0.14em] uppercase text-muted-foreground">
            {messages.supplierWorkspace.kicker}
          </p>
          <CardTitle className="text-[1.375rem] leading-[1.3]">{title}</CardTitle>
          <CardDescription>{intro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">{children}</CardContent>
      </Card>
    </main>
  );
}
