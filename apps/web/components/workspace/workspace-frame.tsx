import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MitigaMark } from '@/components/prototype/mitiga-mark';
import { interpolate, messages } from '@/lib/i18n/messages';
import type { WorkspaceViewModel } from '@/lib/domain/workspace-access';
import type { ReactNode } from 'react';

export function WorkspaceFrame({
  model,
  children,
}: {
  model: WorkspaceViewModel;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-canvas)] px-4 py-10 sm:px-6">
      <a
        href="#workspace-status"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        {messages.workspace.skipToContent}
      </a>
      <Card className="mx-auto w-full max-w-lg shadow-[var(--shadow-sm)] ring-border">
        <CardHeader className="space-y-3">
          <MitigaMark />
          <p className="text-[0.7rem] tracking-[0.14em] uppercase text-muted-foreground">
            {messages.workspace.kicker}
          </p>
          <CardTitle className="text-[1.375rem] leading-[1.3]">
            {messages.workspace.title}
          </CardTitle>
          {model.signedInEmail ? (
            <CardDescription>
              {interpolate(messages.workspace.signedInAs, {
                email: model.signedInEmail,
              })}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </main>
  );
}
