import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { messages } from '@/lib/i18n/messages';
import type { Supplier } from '@/lib/domain/supplier';
import type { TenantId } from '@/lib/domain/ids';

export function SupplierList({ suppliers, tenantId }: { suppliers: Supplier[]; tenantId: TenantId }) {
  if (suppliers.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.supplierWorkspace.emptyTitle}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{messages.supplierWorkspace.reference}</TableHead>
            <TableHead>{messages.supplierWorkspace.displayName}</TableHead>
            <TableHead>{messages.supplierWorkspace.status}</TableHead>
            <TableHead className="sr-only">{messages.supplierWorkspace.open}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-mono text-xs">{supplier.reference}</TableCell>
              <TableCell>{supplier.displayName}</TableCell>
              <TableCell>
                <Badge variant="outline">{messages.supplierWorkspace.statusValues[supplier.status]}</Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/workspace/suppliers/${supplier.id}?tenant=${tenantId}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {messages.supplierWorkspace.open}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
