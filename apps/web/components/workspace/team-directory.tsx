import { messages } from '@/lib/i18n/messages';
import { formatDate } from '@/lib/i18n/presentation';
import { cn } from '@/lib/utils';
import type { DirectoryMember } from '@/lib/domain/invitations';

const t = messages.invitations;

const tone: Record<string, string> = {
  active: 'bg-[var(--mitiga-risk-low-bg)] text-[var(--mitiga-risk-low-fg)]',
  invited: 'bg-[var(--mitiga-mineral-100)] text-[var(--mitiga-petrol-700)]',
  suspended: 'bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]',
  removed: 'bg-muted text-muted-foreground',
};

export function TeamDirectory({ members, currentUserId }: { members: DirectoryMember[]; currentUserId: string }) {
  const visible = members.filter((m) => m.status !== 'removed');
  return (
    <section aria-labelledby="team-title" className="space-y-3">
      <div className="space-y-1">
        <h2 id="team-title" className="text-sm font-semibold">
          {t.teamTitle}
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">{visible.length}</span>
        </h2>
        <p className="text-xs text-muted-foreground">{t.teamIntro}</p>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {visible.map((member) => (
          <li key={member.membershipId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {member.email}
                {member.userId === currentUserId ? <span className="ml-2 text-xs font-normal text-muted-foreground">({t.you})</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {(t.roles as Record<string, string>)[member.roleKey] ?? member.roleKey} · {formatDate(member.createdAt)}
              </p>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone[member.status] ?? tone.removed)}>
              {(t.statuses as Record<string, string>)[member.status] ?? member.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
