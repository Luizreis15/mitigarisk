'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface DetailTab {
  id: string;
  label: string;
  /** Small counter beside the label (pending items); hidden when 0 or undefined. */
  count?: number;
  /** In-page anchors that live inside this tab: a link to one of them opens it. */
  anchors?: string[];
  content: ReactNode;
}

/**
 * Tabs for a record page. Every panel stays mounted (forms keep what was
 * typed). A URL hash naming a tab, or an anchor inside one, opens that tab
 * and scrolls to it, so existing deep links keep working.
 */
export function DetailTabs({ tabs, label }: { tabs: DetailTab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');

  useEffect(() => {
    const open = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const target = tabs.find((tab) => tab.id === hash || tab.anchors?.includes(hash));
      if (!target) return;
      setActive(target.id);
      window.requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }));
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [tabs]);

  return (
    <Tabs value={active} onValueChange={(value) => setActive(String(value))} className="gap-6">
      <TabsList
        aria-label={label}
        variant="line"
        className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border p-0"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'h-11 flex-none rounded-none border-0 px-0 text-sm font-medium text-muted-foreground',
              'after:!bottom-[-1px] after:!h-0.5 after:bg-[var(--mitiga-petrol-700)] data-active:text-foreground',
            )}
          >
            {tab.label}
            {tab.count ? (
              <span className="rounded-full bg-[var(--mitiga-risk-high-bg)] px-1.5 font-mono text-[0.7rem] font-medium text-[var(--mitiga-risk-high-fg)]">
                {tab.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} keepMounted className="space-y-6 data-[hidden]:hidden">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
