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
import { messages } from '@/lib/i18n/messages';
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
  if (suppliers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
        <Building2Icon
          aria-hidden="true"
          className="mx-auto mb-3 size-7 text-muted-foreground"
        />
        <h2 className="font-medium">{messages.supplierWorkspace.emptyTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.supplierWorkspace.emptyBody}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.supplierWorkspace.reference}</TableHead>
              <TableHead>{messages.supplierWorkspace.displayName}</TableHead>
              <TableHead>{messages.supplierWorkspace.status}</TableHead>
              <TableHead className="sr-only">
                {messages.supplierWorkspace.open}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-mono text-xs">
                  {supplier.reference}
                </TableCell>
                <TableCell>{supplier.displayName}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {messages.supplierWorkspace.statusValues[supplier.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/workspace/suppliers/${supplier.id}?tenant=${tenantId}`}
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {messages.supplierWorkspace.open}
                    <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                  </Link>
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
              href={`/workspace/suppliers/${supplier.id}?tenant=${tenantId}`}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {supplier.displayName}
                </span>
                <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                  {supplier.reference}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">
                  {messages.supplierWorkspace.statusValues[supplier.status]}
                </Badge>
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
