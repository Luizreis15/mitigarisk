'use client';

import { DownloadIcon, PrinterIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { messages } from '@/lib/i18n/messages';

const t = messages.auditPack;

export function AuditPackToolbar({ json, fileName, backHref }: { json: string; fileName: string; backHref: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
      <a href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {t.backToCustomer}</a>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-10 gap-2" onClick={download}>
          <DownloadIcon className="size-4" aria-hidden="true" />
          {t.download}
        </Button>
        <Button type="button" className="h-10 gap-2" onClick={() => window.print()}>
          <PrinterIcon className="size-4" aria-hidden="true" />
          {t.print}
        </Button>
      </div>
    </div>
  );
}
