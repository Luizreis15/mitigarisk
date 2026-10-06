import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CustomerBandBadge } from '@/components/workspace/customer-band-badge';
import { messages } from '@/lib/i18n/messages';
import { ddLevelShortLabel } from '@/lib/i18n/customer-assessment';
import { formatDate } from '@/lib/i18n/presentation';
import type { Customer } from '@/lib/domain/customer';
import type { CustomerAssessment } from '@/lib/domain/customer-assessment';
import type { TenantId } from '@/lib/domain/ids';
import { ArrowRightIcon, UsersIcon } from 'lucide-react';

export interface CustomerListRow {
  customer: Customer;
  latest: CustomerAssessment | null;
}

// Renders the persisted latest band/DD level per customer exactly as stored;
// a customer with no assessment shows "Not assessed yet", never a guess.
export function CustomerList({
  rows,
  tenantId,
  canCreate,
}: {
  rows: CustomerListRow[];
  tenantId: TenantId;
  canCreate: boolean;
}) {
  const t = messages.customerWorkspace;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
        <UsersIcon
          aria-hidden="true"
          className="mx-auto mb-3 size-7 text-muted-foreground"
        />
        <h2 className="font-medium">{t.emptyTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canCreate ? t.emptyBodyCanCreate : t.emptyBody}
        </p>
      </div>
    );
  }

  const href = (customer: Customer) =>
    `/workspace/customers/${customer.id}?tenant=${tenantId}`;

  return (
    <section aria-label={t.listLabel}>
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columns.name}</TableHead>
              <TableHead>{t.columns.externalReference}</TableHead>
              <TableHead>{t.columns.nationalityResidence}</TableHead>
              <TableHead>{t.columns.latestBand}</TableHead>
              <TableHead>{t.columns.latestDdLevel}</TableHead>
              <TableHead>{t.columns.nextReviewDue}</TableHead>
              <TableHead className="sr-only">{t.columns.open}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ customer, latest }) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.fullName}</TableCell>
                <TableCell className="font-mono text-xs">
                  {customer.externalReference}
                </TableCell>
                <TableCell>
                  {customer.nationality} / {customer.residenceCountry}
                </TableCell>
                <TableCell>
                  {latest ? (
                    <CustomerBandBadge band={latest.band} />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t.notAssessed}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {latest ? (
                    <Badge variant="outline">
                      {ddLevelShortLabel(latest.ddLevel)}
                    </Badge>
                  ) : (
                    t.emptyValue
                  )}
                </TableCell>
                <TableCell>
                  {latest ? formatDate(latest.nextReviewDue) : t.emptyValue}
                </TableCell>
                <TableCell>
                  <Link
                    href={href(customer)}
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t.open}
                    <span className="sr-only"> {customer.fullName}</span>
                    <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-3 sm:hidden">
        {rows.map(({ customer, latest }) => (
          <li key={customer.id}>
            <Link
              href={href(customer)}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {customer.fullName}
                </span>
                <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                  {customer.externalReference}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {customer.nationality} / {customer.residenceCountry}
                  {latest
                    ? ` · ${t.columns.nextReviewDue}: ${formatDate(latest.nextReviewDue)}`
                    : ''}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-2">
                {latest ? (
                  <>
                    <CustomerBandBadge band={latest.band} />
                    <Badge variant="outline">
                      {ddLevelShortLabel(latest.ddLevel)}
                    </Badge>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t.notAssessed}
                  </span>
                )}
              </span>
              <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
