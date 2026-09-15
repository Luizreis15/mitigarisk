import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { messages } from '@/lib/i18n/messages';
import type { SupplierEvidence } from '@/lib/domain/supplier-evidence';

export function SupplierEvidenceList({ evidence }: { evidence: SupplierEvidence[] }) {
  const t = messages.supplierWorkspace.evidence;

  return (
    <section aria-labelledby="supplier-evidence" className="space-y-2 border-t border-border pt-4">
      <h2 id="supplier-evidence" className="text-sm font-medium">
        {t.title}
      </h2>
      <p className="text-xs text-muted-foreground">{t.disclosure}</p>
      {evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.emptyTitle}</p>
      ) : (
        <div className="overflow-x-auto">
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
                    <Badge variant="outline">{t.verificationStates[entry.verificationState]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
