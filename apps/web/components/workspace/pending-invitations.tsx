import { MailIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { acceptInvitationAction } from '@/app/workspace/access/actions';
import { interpolate, messages } from '@/lib/i18n/messages';
import type { PendingInvitation } from '@/lib/domain/invitations';

const t = messages.invitations;

export function PendingInvitations({ invitations }: { invitations: PendingInvitation[] }) {
  if (invitations.length === 0) return null;
  return (
    <section aria-labelledby="pending-invitations-title" className="space-y-2 rounded-xl border border-[color-mix(in_srgb,var(--mitiga-info)_40%,transparent)] bg-[var(--mitiga-mineral-100)]/60 p-4">
      <h2 id="pending-invitations-title" className="flex items-center gap-2 text-sm font-semibold">
        <MailIcon className="size-4" aria-hidden="true" />
        {t.pendingTitle}
      </h2>
      <ul className="space-y-2">
        {invitations.map((invitation) => (
          <li key={invitation.membershipId} className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              {interpolate(t.pendingLine, {
                company: invitation.tenantName,
                role: (t.roles as Record<string, string>)[invitation.roleKey] ?? invitation.roleKey,
              })}
            </p>
            <form action={acceptInvitationAction}>
              <input type="hidden" name="membershipId" value={invitation.membershipId} />
              <input type="hidden" name="tenantId" value={invitation.tenantId} />
              <Button type="submit" className="h-10">{t.accept}</Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
