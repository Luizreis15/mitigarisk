'use client';

import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomerBandBadge } from '@/components/workspace/customer-band-badge';
import {
  filterCustomerListRows,
  summarizeCustomerListRows,
  type CustomerListBandFilter,
} from '@/lib/domain/customer-list-filter';
import { messages, interpolate } from '@/lib/i18n/messages';
import { ddLevelShortLabel } from '@/lib/i18n/customer-assessment';
import { formatDate } from '@/lib/i18n/presentation';
import type { Customer } from '@/lib/domain/customer';
import type { CustomerAssessment } from '@/lib/domain/customer-assessment';
import type { TenantId } from '@/lib/domain/ids';
import { cn } from '@/lib/utils';
import { ArrowRightIcon, PlusIcon, SearchIcon, UsersIcon } from 'lucide-react';

export interface CustomerListRow {
  customer: Customer;
  latest: CustomerAssessment | null;
}

const BAND_FILTERS: CustomerListBandFilter[] = [
  'ALL',
  'LOW',
  'MEDIUM',
  'HIGH',
  'UNASSESSED',
];

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
  const f = t.listFilters;
  const [query, setQuery] = useState('');
  const [band, setBand] = useState<CustomerListBandFilter>('ALL');
  const deferredQuery = useDeferredValue(query);

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
  const summary = summarizeCustomerListRows(rows);
  const filtered = filterCustomerListRows(rows, { query: deferredQuery, band });
  const s = t.summary;

  const filterLabel = (value: CustomerListBandFilter) => {
    switch (value) {
      case 'ALL':
        return interpolate(f.all, { count: String(summary.total) });
      case 'LOW':
        return interpolate(s.low, { count: String(summary.low) });
      case 'MEDIUM':
        return interpolate(s.medium, { count: String(summary.medium) });
      case 'HIGH':
        return interpolate(s.high, { count: String(summary.high) });
      case 'UNASSESSED':
        return interpolate(s.unassessed, { count: String(summary.unassessed) });
    }
  };

  return (
    <section aria-label={t.listLabel} className="space-y-0">
      <div className="sticky top-[var(--topbar-height)] z-20 -mx-4 border-b border-border bg-[color-mix(in_srgb,var(--color-bg-canvas)_92%,transparent)] px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={f.searchPlaceholder}
              aria-label={f.searchLabel}
              className="h-11 bg-card pl-9"
            />
          </div>
          {canCreate ? (
            <Button
              className="h-11 w-full shrink-0 sm:w-auto"
              render={<Link href={`/workspace/customers/new?tenant=${tenantId}`} />}
            >
              <PlusIcon aria-hidden="true" />
              {t.newCustomer}
            </Button>
          ) : null}
        </div>

        <fieldset className="mt-3 min-w-0">
          <legend className="sr-only">{f.bandLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {BAND_FILTERS.map((value) => {
              if (value === 'UNASSESSED' && summary.unassessed === 0) return null;
              const active = band === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBand(value)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {filterLabel(value)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="mt-2 text-xs text-muted-foreground">
          {interpolate(f.showing, {
            shown: String(filtered.length),
            total: String(summary.total),
          })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
          <p className="font-medium">{f.noResultsTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{f.noResultsBody}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-11"
            onClick={() => {
              setQuery('');
              setBand('ALL');
            }}
          >
            {f.clearFilters}
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-0 hidden sm:block">
            <div className="-mx-4 overflow-x-auto border-b border-border sm:-mx-6 lg:-mx-8">
              <Table className="min-w-[56rem]">
                <TableHeader className="sticky top-[calc(var(--topbar-height)+7.5rem)] z-10 bg-card/95 backdrop-blur-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 px-4 text-xs">{t.columns.name}</TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.externalReference}</TableHead>
                    <TableHead className="h-10 text-xs">
                      {t.columns.nationalityResidence}
                    </TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.latestBand}</TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.latestDdLevel}</TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.nextReviewDue}</TableHead>
                    <TableHead className="sr-only">{t.columns.open}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(({ customer, latest }) => (
                    <TableRow key={customer.id} className="group relative h-12">
                      <TableCell className="px-4 py-2 font-medium">
                        <Link
                          href={href(customer)}
                          className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={interpolate(t.openCustomer, {
                            name: customer.fullName,
                          })}
                        />
                        <span className="relative">{customer.fullName}</span>
                      </TableCell>
                      <TableCell className="py-2 font-mono text-xs">
                        {customer.externalReference}
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {customer.nationality} / {customer.residenceCountry}
                      </TableCell>
                      <TableCell className="py-2">
                        {latest ? (
                          <CustomerBandBadge band={latest.band} />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t.notAssessed}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {latest ? (
                          <Badge variant="outline">
                            {ddLevelShortLabel(latest.ddLevel)}
                          </Badge>
                        ) : (
                          t.emptyValue
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {latest ? formatDate(latest.nextReviewDue) : t.emptyValue}
                      </TableCell>
                      <TableCell className="py-2 pr-4">
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
          </div>

          <ul className="mt-4 space-y-2 sm:hidden">
            {filtered.map(({ customer, latest }) => (
              <li key={customer.id}>
                <Link
                  href={href(customer)}
                  className="flex min-h-14 min-w-0 items-center justify-between gap-3 border-b border-border bg-card/40 px-1 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{customer.fullName}</span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                      {customer.externalReference}
                      {' · '}
                      {customer.nationality}/{customer.residenceCountry}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {latest ? (
                      <CustomerBandBadge band={latest.band} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.notAssessed}</span>
                    )}
                    <ArrowRightIcon aria-hidden="true" className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
