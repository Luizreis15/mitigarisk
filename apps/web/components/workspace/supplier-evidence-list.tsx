import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { messages } from '@/lib/i18n/messages';
import type { SupplierEvidence } from '@/lib/domain/supplier-evidence';
import { BadgeCheckIcon, FileTextIcon } from 'lucide-react';

export function SupplierEvidenceList({
  evidence,
}: {
  evidence: SupplierEvidence[];
}) {
  const t = messages.supplierWorkspace.evidence;

  return (
    <section
      aria-labelledby="supplier-evidence"
      className="space-y-4 rounded-xl border border-border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="supplier-evidence" className="text-base font-medium">
            {t.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t.disclosure}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <FileTextIcon aria-hidden="true" />
          {t.metadataBadge}
        </Badge>
      </div>
      {evidence.length === 0 ? (
        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-sm font-medium">{t.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.emptyBody}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm font-medium">
            <BadgeCheckIcon
              aria-hidden="true"
              className="size-4 text-primary"
            />
            {t.recordedCount.replace('{count}', String(evidence.length))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.type}</TableHead>
                  <TableHead>{t.columns.displayName}</TableHead>
                  <TableHead>{t.columns.issuerCountry}</TableHead>
                  <TableHead>{t.columns.issueDate}</TableHead>
                  <TableHead>{t.columns.verificationState}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{t.types[entry.evidenceType]}</TableCell>
                    <TableCell>{entry.displayName}</TableCell>
                    <TableCell>{entry.issuerCountryCode ?? '—'}</TableCell>
                    <TableCell>{entry.issueDate ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t.verificationStates[entry.verificationState]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 sm:hidden">
            {evidence.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <span className="min-w-0 break-all font-medium">
                    {entry.displayName}
                  </span>
                  <Badge variant="outline">
                    {t.verificationStates[entry.verificationState]}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{t.columns.type}</dt>
                    <dd className="mt-1">{t.types[entry.evidenceType]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t.columns.issuerCountry}
                    </dt>
                    <dd className="mt-1">{entry.issuerCountryCode ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t.columns.issueDate}
                    </dt>
                    <dd className="mt-1">{entry.issueDate ?? '—'}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
