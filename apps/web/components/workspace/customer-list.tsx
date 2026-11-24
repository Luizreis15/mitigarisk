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
import { ArrowRightIcon, FileTextIcon, PlusIcon, SearchIcon, UploadIcon, UsersIcon } from 'lucide-react';

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
const markerColor = { LOW: 'var(--risk-low)', MEDIUM: 'var(--risk-medium)', HIGH: 'var(--risk-high)' } as const;

/** Stored score on a miniature of the risk scale (display only). */
function ScoreMarker({ score, band }: { score: number; band: keyof typeof markerColor }) {
  const position = Math.min(100, Math.max(0, score));
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="w-9 text-right font-mono text-sm font-medium">{score}</span>
      <span aria-hidden="true" className="relative h-1.5 w-20 rounded-full bg-[linear-gradient(90deg,var(--mitiga-risk-low-bg)_0_36%,var(--mitiga-risk-medium-bg)_36%_76%,var(--mitiga-risk-high-bg)_76%)]">
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm" style={{ left: `${position}%`, background: markerColor[band] }} />
      </span>
    </span>
  );
}

export function CustomerList({
  rows,
  tenantId,
  canCreate,
  canReport = false,
}: {
  rows: CustomerListRow[];
  tenantId: TenantId;
  canCreate: boolean;
  /** Server-confirmed audit.view: shows the portfolio report entry. */
  canReport?: boolean;
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
      <div className="pb-4">
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
              className="h-10 bg-card pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {canReport ? (
              <Button
                variant="outline"
                className="h-10 w-full shrink-0 bg-card sm:w-auto"
                render={<Link href={`/workspace/customers/report?tenant=${tenantId}`} />}
              >
                <FileTextIcon aria-hidden="true" />
                {messages.portfolioReport.open}
              </Button>
            ) : null}
            {canCreate ? (
              <>
              <Button
                className="h-10 w-full shrink-0 sm:w-auto md:hidden"
                render={<Link href={`/workspace/customers/new?tenant=${tenantId}`} />}
              >
                <PlusIcon aria-hidden="true" />
                {t.newCustomer}
              </Button>
              <Button
                variant="outline"
                className="h-10 w-full shrink-0 bg-card sm:w-auto"
                render={<Link href={`/workspace/customers/import?tenant=${tenantId}`} />}
              >
                <UploadIcon aria-hidden="true" />
                {t.importCustomers}
              </Button>
              </>
            ) : null}
          </div>
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
                    'inline-flex h-8 items-center rounded-full border px-3 text-[0.8rem] transition-colors',
                    active
                      ? 'border-[var(--mitiga-ink-950)] bg-[var(--mitiga-ink-950)] font-medium text-white'
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
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-[var(--shadow-xs)]">
              <Table className="min-w-[52rem]">
                <TableHeader className="bg-muted/60 [&_th]:text-[0.7rem] [&_th]:font-semibold [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th]:uppercase">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 px-4 text-xs">{t.columns.name}</TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.externalReference}</TableHead>
                    <TableHead className="h-10 text-xs">
                      {t.columns.nationalityResidence}
                    </TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.score}</TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.latestBand}</TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.latestDdLevel}</TableHead>
                    <TableHead className="h-10 text-xs">{t.columns.nextReviewDue}</TableHead>
                    <TableHead className="sr-only">{t.columns.open}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(({ customer, latest }) => (
                    <TableRow key={customer.id} className="group relative h-[3.25rem] transition-colors hover:bg-[var(--mitiga-risk-neutral-bg)]/40">
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
                        {latest ? <ScoreMarker score={latest.overallScore} band={latest.band} /> : t.emptyValue}
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
