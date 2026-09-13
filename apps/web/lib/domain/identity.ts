import type { UserId } from "./ids";

// The identity of the caller behind the current request. Always resolved
// server-side from a verified Supabase session (apps/web/lib/supabase/identity.ts)
// — never accepted as a client-supplied value. See
// docs/tasks/TASK-006-claude-auth-and-tenant-bootstrap.md: "Never trust a
// client-provided tenant id, actor id, capability, or role."
export interface RequestIdentity {
  userId: UserId;
  isPlatformAdmin: boolean;
}
