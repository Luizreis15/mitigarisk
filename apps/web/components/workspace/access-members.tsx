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
import type { Membership } from '@/lib/domain/tenancy';
import type { UserId } from '@/lib/domain/ids';
import { UsersIcon } from 'lucide-react';

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
    <section aria-label={t.membersLabel} className="space-y-3">
      <h2 className="text-base font-medium">{t.membersTitle}</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">{t.columns.person}</TableHead>
              <TableHead>{t.columns.role}</TableHead>
              <TableHead>{t.columns.status}</TableHead>
              <TableHead>{t.columns.joined}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isYou = member.userId === currentUserId;
              return (
                <TableRow key={member.id}>
                  <TableCell className="px-4 font-medium">
                    {isYou ? t.you : shortActorId(member.userId)}
                  </TableCell>
                  <TableCell>{membershipRoleLabel(member.roleKey)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{membershipStatusLabel(member.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(member.createdAt)}
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
