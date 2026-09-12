'use client';

import type { ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toast';

export function PrototypeProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <Toaster>{children}</Toaster>
    </TooltipProvider>
  );
}
