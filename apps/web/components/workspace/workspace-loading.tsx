import { Skeleton } from '@/components/ui/skeleton';
import { messages } from '@/lib/i18n/messages';

// Shown by app/workspace/loading.tsx while a workspace page reads its data.
// It repeats the shell's own grid, sidebar gradient and top bar height, so
// the frame stays still and only the content area changes when the page
// arrives. No data and no navigation: nothing here depends on the tenant.
export function WorkspaceLoading() {
  return (
    <div className="min-h-screen bg-[image:var(--gradient-canvas)] text-foreground" aria-busy="true">
      <output className="sr-only">{messages.realShell.loading}</output>
      <div className="md:grid md:grid-cols-[4.25rem_minmax(0,1fr)] lg:grid-cols-[15.5rem_minmax(0,1fr)]" aria-hidden="true">
        <div className="sticky top-0 hidden h-screen flex-col bg-[image:var(--gradient-shell)] md:flex">
          <div className="h-[var(--topbar-height)] border-b border-white/8" />
          <div className="flex flex-col gap-3 px-2.5 py-4">
            <div className="h-10 rounded-md bg-white/15" />
            <div className="mt-2 h-9 rounded-md bg-white/8" />
            <div className="h-9 rounded-md bg-white/8" />
            <div className="h-9 rounded-md bg-white/8" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="sticky top-0 flex h-[var(--topbar-height)] items-center justify-between border-b border-border bg-card px-4 sm:px-6 lg:px-8">
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <Skeleton className="size-9 rounded-full" />
          </div>
          <div className="mx-auto flex w-full max-w-[var(--content-max-width)] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="space-y-3">
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="hidden h-24 rounded-xl sm:block" />
              <Skeleton className="hidden h-24 rounded-xl sm:block" />
            </div>
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
