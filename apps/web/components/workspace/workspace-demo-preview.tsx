import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { messages } from '@/lib/i18n/messages';

export function WorkspaceDemoPreview() {
  return (
    <section
      aria-labelledby="workspace-demo-preview"
      className="space-y-2 rounded-xl border border-dashed border-border p-4"
    >
      <h2
        id="workspace-demo-preview"
        className="text-sm font-medium tracking-[0.04em] text-muted-foreground uppercase"
      >
        {messages.workspace.demoPreviewTitle}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        {messages.workspace.demoPreviewHint}
      </p>
      <Button
        variant="outline"
        className="h-11 w-full sm:w-auto"
        render={<Link href="/tenants" />}
      >
        {messages.workspace.demoPreviewLink}
      </Button>
    </section>
  );
}
