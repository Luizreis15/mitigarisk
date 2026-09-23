import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/auth-actions';
import { messages } from '@/lib/i18n/messages';

export function WorkspaceSessionActions({
  showsAuthenticatedSession,
}: {
  showsAuthenticatedSession: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {showsAuthenticatedSession ? (
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="h-11 w-full sm:w-auto">
            {messages.workspace.signOut}
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          className="h-11 w-full sm:w-auto"
          render={<Link href="/" />}
        >
          {messages.workspace.backToSignIn}
        </Button>
      )}
    </div>
  );
}
