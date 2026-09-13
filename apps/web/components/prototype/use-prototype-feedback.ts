'use client';

import { useToastManager } from '@/components/ui/toast';

export function usePrototypeFeedback() {
  const toast = useToastManager();

  return (title: string, description: string) => {
    toast.add({
      title,
      description,
      type: 'info',
    });
  };
}
