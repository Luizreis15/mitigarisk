import Link from 'next/link';
import { AlertCircleIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { messages } from '@/lib/i18n/messages';

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-canvas)] px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>{messages.authLinkError.title}</CardTitle></CardHeader>
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
