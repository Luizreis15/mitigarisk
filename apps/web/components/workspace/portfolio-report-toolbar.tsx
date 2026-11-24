'use client';

import { DownloadIcon, PrinterIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { messages } from '@/lib/i18n/messages';

const t = messages.portfolioReport;

function save(content: string, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Both files are built on the server from the same report object; the
// browser only saves them. The UTF-8 mark lets spreadsheets read accents.
export function PortfolioReportToolbar({
  json,
  csv,
  fileBase,
  backHref,
}: {
  json: string;
  csv: string;
  fileBase: string;
  backHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
      <a href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {t.back}</a>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => save(`﻿${csv}`, 'text/csv;charset=utf-8', `${fileBase}.csv`)}>
          <DownloadIcon className="size-4" aria-hidden="true" />
          {t.downloadCsv}
        </Button>
        <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => save(json, 'application/json', `${fileBase}.json`)}>
          <DownloadIcon className="size-4" aria-hidden="true" />
          {t.downloadJson}
        </Button>
        <Button type="button" className="h-10 gap-2" onClick={() => window.print()}>
          <PrinterIcon className="size-4" aria-hidden="true" />
          {t.print}
        </Button>
      </div>
    </div>
  );
}
