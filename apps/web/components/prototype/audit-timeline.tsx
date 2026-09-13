import { timelineActionLabels } from '@/lib/demo/labels';
import type { DemoTimelineEvent } from '@/lib/demo/types';
import { presentation } from '@/lib/demo/data';
import { interpolate, messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';

export function AuditTimeline({ events }: { events: DemoTimelineEvent[] }) {
  return (
    <ol className="grid gap-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-lg border bg-card p-3">
          <p className="text-sm font-medium">{timelineActionLabels[event.action]}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {interpolate(messages.flow.timeline.token, { action: event.action })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {event.actor} · {formatDateTime(event.at, presentation)} · {event.correlationId}
          </p>
        </li>
      ))}
    </ol>
  );
}
