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
      <section aria-label={t.trailLabel} className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{t.trailTitle}</h2>
        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t.trailUnavailable}
        </p>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section aria-label={t.trailLabel} className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{t.trailTitle}</h2>
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
    <section aria-label={t.trailLabel} className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t.trailTitle}</h2>
        <p className="text-xs text-muted-foreground tabular-nums">{events.length}</p>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4 text-xs">{t.columns.when}</TableHead>
              <TableHead className="h-10 text-xs">{t.columns.who}</TableHead>
              <TableHead className="h-10 text-xs">{t.columns.action}</TableHead>
              <TableHead className="h-10 text-xs">{t.columns.target}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const who =
                event.actorId === currentUserId
                  ? t.you
                  : shortActorId(event.actorId);
              return (
                <TableRow key={event.id} className="h-12">
                  <TableCell className="px-4 py-2 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(event.occurredAt)}
                  </TableCell>
                  <TableCell className="py-2 text-sm font-medium">{who}</TableCell>
                  <TableCell className="py-2 text-sm">
                    {auditActionLabel(event.action)}
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                    {event.targetType}
                    {event.targetId ? ` · ${event.targetId.slice(0, 8)}` : ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-0 sm:hidden">
        {events.map((event) => {
          const who =
            event.actorId === currentUserId ? t.you : shortActorId(event.actorId);
          return (
            <li
              key={event.id}
              className="border-l-[3px] border-l-[var(--mitiga-petrol-700)]/70 border-b border-b-border px-3 py-3"
            >
              <p className="text-sm font-medium text-foreground">
                {auditActionLabel(event.action)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {who}
                {event.targetType ? ` · ${event.targetType}` : ''}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--mitiga-petrol-700)]">
                {formatDateTime(event.occurredAt)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
