import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auditActionLabel, shortActorId } from '@/lib/i18n/access';
import { messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';
import type { AuditEventRow } from '@/lib/domain/audit-event';
import type { UserId } from '@/lib/domain/ids';
import { ScrollTextIcon } from 'lucide-react';

export function AccessAuditTrail({
  events,
  currentUserId,
  canView,
}: {
  events: AuditEventRow[];
  currentUserId: UserId;
  canView: boolean;
}) {
  const t = messages.accessWorkspace;

  if (!canView) {
    return (
      <section aria-label={t.trailLabel} className="space-y-3">
        <h2 className="text-base font-medium">{t.trailTitle}</h2>
        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t.trailUnavailable}
        </p>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section aria-label={t.trailLabel} className="space-y-3">
        <h2 className="text-base font-medium">{t.trailTitle}</h2>
        <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
          <ScrollTextIcon
            aria-hidden="true"
            className="mx-auto mb-3 size-7 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">{t.trailEmpty}</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={t.trailLabel} className="space-y-3">
      <h2 className="text-base font-medium">{t.trailTitle}</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">{t.columns.when}</TableHead>
              <TableHead>{t.columns.who}</TableHead>
              <TableHead>{t.columns.action}</TableHead>
              <TableHead>{t.columns.target}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const who =
                event.actorId === currentUserId
                  ? t.you
                  : shortActorId(event.actorId);
              return (
                <TableRow key={event.id}>
                  <TableCell className="px-4 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(event.occurredAt)}
                  </TableCell>
                  <TableCell className="font-medium">{who}</TableCell>
                  <TableCell>{auditActionLabel(event.action)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {event.targetType}
                    {event.targetId ? ` · ${event.targetId.slice(0, 8)}` : ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
