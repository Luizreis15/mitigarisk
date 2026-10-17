import Link from 'next/link';
import { AlertCircleIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { messages } from '@/lib/i18n/messages';
import {
  isSupportedAuthCallbackType,
  safeAuthDestination,
} from '@/lib/supabase/site-url';
import { confirmAuthLinkAction } from '@/app/auth-actions';

/**
 * Human click-through before verifyOtp. Email scanners (Outlook SafeLinks,
 * corporate gateways) prefetch GET links and burn one-time recovery tokens.
 * The email still lands on /auth/confirm; that route only validates params
 * and redirects here. OTP verification runs on POST from this page.
 */
export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : '';
  const rawType = typeof params.type === 'string' ? params.type : '';
  const nextRaw = typeof params.next === 'string' ? params.next : null;
  const destination = safeAuthDestination(nextRaw);

  if (!tokenHash || !isSupportedAuthCallbackType(rawType)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-canvas)] px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{messages.authLinkError.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive" role="alert">
              <AlertCircleIcon />
              <AlertTitle>{messages.authLinkError.notice}</AlertTitle>
              <AlertDescription>{messages.authLinkError.body}</AlertDescription>
            </Alert>
            <Button className="w-full" render={<Link href="/reset-password" />}>
              {messages.authLinkError.action}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-canvas)] px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{messages.authContinue.title}</CardTitle>
          <CardDescription>{messages.authContinue.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={confirmAuthLinkAction} className="space-y-3">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={rawType} />
            <input type="hidden" name="next" value={destination} />
            <Button type="submit" className="w-full">
              {messages.authContinue.action}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
