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
import { messages, interpolate } from '@/lib/i18n/messages';
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

function summarize(rows: CustomerListRow[]) {
  let low = 0;
  let medium = 0;
  let high = 0;
  let unassessed = 0;
  for (const { latest } of rows) {
    if (!latest) {
      unassessed += 1;
      continue;
    }
    if (latest.band === 'LOW') low += 1;
    else if (latest.band === 'MEDIUM') medium += 1;
    else high += 1;
  }
  return { total: rows.length, low, medium, high, unassessed };
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
      <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-12 text-center">
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
  const summary = summarize(rows);
  const s = t.summary;

  return (
    <section aria-label={t.listLabel} className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"
        aria-label={s.label}
      >
        <span className="font-medium text-foreground">
          {interpolate(s.total, { count: String(summary.total) })}
        </span>
        <span className="text-muted-foreground" aria-hidden="true">
          ·
        </span>
        <span className="text-muted-foreground">
          {interpolate(s.low, { count: String(summary.low) })}
        </span>
        <span className="text-muted-foreground" aria-hidden="true">
          ·
        </span>
        <span className="text-muted-foreground">
          {interpolate(s.medium, { count: String(summary.medium) })}
        </span>
        <span className="text-muted-foreground" aria-hidden="true">
          ·
        </span>
        <span className="text-muted-foreground">
          {interpolate(s.high, { count: String(summary.high) })}
        </span>
        {summary.unassessed > 0 ? (
          <>
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <span className="text-muted-foreground">
              {interpolate(s.unassessed, { count: String(summary.unassessed) })}
            </span>
          </>
        ) : null}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">{t.columns.name}</TableHead>
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
              <TableRow key={customer.id} className="group relative">
                <TableCell className="px-4 font-medium">
                  <Link
                    href={href(customer)}
                    className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={interpolate(t.openCustomer, {
                      name: customer.fullName,
                    })}
                  />
                  <span className="relative">{customer.fullName}</span>
                </TableCell>
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
                <TableCell className="pr-4">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-80 group-hover:opacity-100">
                    {t.open}
                    <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                  </span>
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
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
