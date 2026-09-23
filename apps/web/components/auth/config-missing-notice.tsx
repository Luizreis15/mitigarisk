import { AlertTriangleIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Rendered instead of a real auth form when the Development environment is
// missing its public Supabase configuration
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md: "Missing
// public Supabase configuration must produce a clear, non-sensitive
// configuration state rather than a crash or a fallback to fake
// authentication"). Names only the two public variable names — never a
// value, and never anything from the server-only/service-role boundary.
export function ConfigMissingNotice({ title, body }: { title: string; body: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{body}</AlertDescription>
    </Alert>
  );
}
