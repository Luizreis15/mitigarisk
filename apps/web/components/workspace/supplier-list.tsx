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
import { interpolate, messages } from '@/lib/i18n/messages';
import type { Supplier } from '@/lib/domain/supplier';
import type { TenantId } from '@/lib/domain/ids';
import { ArrowRightIcon, Building2Icon } from 'lucide-react';

export function SupplierList({
  suppliers,
  tenantId,
}: {
  suppliers: Supplier[];
  tenantId: TenantId;
}) {
  const t = messages.supplierWorkspace;

  if (suppliers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-12 text-center">
        <Building2Icon
          aria-hidden="true"
          className="mx-auto mb-3 size-7 text-muted-foreground"
        />
        <h2 className="font-medium">{t.emptyTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.emptyBody}</p>
      </div>
    );
  }

  const href = (supplier: Supplier) =>
    `/workspace/suppliers/${supplier.id}?tenant=${tenantId}`;

  return (
    <section aria-label={t.listTitle} className="space-y-4">
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <span className="font-medium text-foreground">
          {interpolate(t.listSummary, { count: String(suppliers.length) })}
        </span>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">{t.displayName}</TableHead>
              <TableHead>{t.reference}</TableHead>
              <TableHead>{t.status}</TableHead>
              <TableHead className="sr-only">{t.open}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id} className="group relative">
                <TableCell className="px-4 font-medium">
                  <Link
                    href={href(supplier)}
                    className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${t.open} ${supplier.displayName}`}
                  />
                  <span className="relative">{supplier.displayName}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{supplier.reference}</TableCell>
                <TableCell>
                  <Badge variant="outline">{t.statusValues[supplier.status]}</Badge>
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
        {suppliers.map((supplier) => (
          <li key={supplier.id}>
            <Link
              href={href(supplier)}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{supplier.displayName}</span>
                <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                  {supplier.reference}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{t.statusValues[supplier.status]}</Badge>
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
