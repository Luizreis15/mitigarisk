import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  membershipRoleLabel,
  membershipStatusLabel,
  shortActorId,
} from '@/lib/i18n/access';
import { messages } from '@/lib/i18n/messages';
import { formatDateTime } from '@/lib/i18n/presentation';
import type { Membership, MembershipStatus } from '@/lib/domain/tenancy';
import type { UserId } from '@/lib/domain/ids';
import { cn } from '@/lib/utils';
import { UsersIcon } from 'lucide-react';

const statusTone: Record<MembershipStatus, string> = {
  active:
    'border-[color-mix(in_srgb,var(--mitiga-success)_40%,transparent)] bg-[var(--mitiga-risk-low-bg)] text-[var(--mitiga-risk-low-fg)]',
  invited:
    'border-[color-mix(in_srgb,var(--mitiga-warning)_40%,transparent)] bg-[var(--mitiga-risk-medium-bg)] text-[var(--mitiga-risk-medium-fg)]',
  suspended:
    'border-[color-mix(in_srgb,var(--mitiga-danger)_35%,transparent)] bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]',
  removed: 'border-border bg-muted text-muted-foreground',
};

export function AccessMembers({
  members,
  currentUserId,
}: {
  members: Membership[];
  currentUserId: UserId;
}) {
  const t = messages.accessWorkspace;

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
        <UsersIcon aria-hidden="true" className="mx-auto mb-3 size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t.membersEmpty}</p>
      </div>
    );
  }

  return (
    <section aria-label={t.membersLabel} className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t.membersTitle}</h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {members.length}
        </p>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4 text-xs">{t.columns.person}</TableHead>
              <TableHead className="h-10 text-xs">{t.columns.role}</TableHead>
              <TableHead className="h-10 text-xs">{t.columns.status}</TableHead>
              <TableHead className="h-10 text-xs">{t.columns.joined}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isYou = member.userId === currentUserId;
              return (
                <TableRow key={member.id} className="h-12">
                  <TableCell className="px-4 py-2 font-medium">
                    {isYou ? t.you : shortActorId(member.userId)}
                  </TableCell>
                  <TableCell className="py-2 text-sm">
                    {membershipRoleLabel(member.roleKey)}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant="outline"
                      className={cn('font-medium', statusTone[member.status])}
                    >
                      {membershipStatusLabel(member.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">
                    {formatDateTime(member.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2 sm:hidden">
        {members.map((member) => {
          const isYou = member.userId === currentUserId;
          return (
            <li
              key={member.id}
              className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-1 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {isYou ? t.you : shortActorId(member.userId)}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {membershipRoleLabel(member.roleKey)}
                </span>
              </span>
              <Badge
                variant="outline"
                className={cn('shrink-0 font-medium', statusTone[member.status])}
              >
                {membershipStatusLabel(member.status)}
              </Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
