import { WorkspaceExperience } from '@/components/workspace/workspace-experience';
import { buildWorkspaceViewModel } from '@/lib/domain/workspace-access';
import { classifyTenantSelectionError } from '@/lib/domain/tenant-selection';
import type { TenantOptionView } from '@/lib/domain/workspace-access';
import type { TenantId } from '@/lib/domain/ids';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { resolveActiveTenantContext } from '@/lib/supabase/tenant-context';

// Real protected product route
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md,
// docs/tasks/TASK-018-cursor-authenticated-workspace-experience.md, and
// docs/tasks/TASK-019-claude-tenant-authorization-boundary.md).
// requireAuthenticatedIdentity() fails closed before authenticated content
// renders. The `tenant` query param is never trusted on its own and never
// pre-validated for shape here: it is passed to resolveActiveTenantContext()
// exactly as received (including a malformed value), which proves it
// against the caller's real active memberships, fetched server-side, on
// every request. A malformed, stale, or cross-tenant value all fail the
// same way there — InvalidTenantSelectionError — and this route must never
// respond to that by silently re-resolving with no candidate id: that
// would auto-select a different tenant than the one requested whenever
// exactly one active membership remains, which is not a safe fallback.
// Presentation receives only the resulting server-derived values and never
// infers tenant context, roles, or capabilities itself.
export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  if (!hasPublicSupabaseConfig()) {
    return (
      <WorkspaceExperience
        model={buildWorkspaceViewModel({
          publicConfigAvailable: false,
          membershipReadFailed: false,
          isPlatformAdmin: false,
          activeMembershipCount: 0,
          signedInEmail: null,
        })}
      />
    );
  }

  const identity = await requireAuthenticatedIdentity();
  const client = await createServerSupabaseClient();
  const { data: userData } = await client.auth.getUser();
  const email = userData.user?.email ?? null;

  if (identity.isPlatformAdmin) {
    // Ratified policy (docs/adr/0011-tenant-authorization-boundary.md,
    // "Ratification"): the workspace shell requires only verified identity
    // plus active membership — platform status is handled explicitly and
    // never falls through to tenant-membership resolution, so it cannot
    // silently grant entry to a tenant operational workspace.
    return (
      <WorkspaceExperience
        model={buildWorkspaceViewModel({
          publicConfigAvailable: true,
          membershipReadFailed: false,
          isPlatformAdmin: true,
          activeMembershipCount: 0,
          signedInEmail: email,
        })}
      />
    );
  }

  const rawTenant = (await searchParams).tenant;
  // Any non-empty value is a real selection attempt, valid UUID shape or
  // not: resolveActiveTenantContext treats it purely as a lookup key
  // against real memberships, so a malformed string simply never matches
  // and reaches the same InvalidTenantSelectionError path as a
  // well-formed but stale or cross-tenant id. There is no separate
  // "looks wrong, discard it" shortcut here — that would be a second,
  // weaker validation path outside the typed-error boundary.
  const requestedTenantId = rawTenant ? (rawTenant as TenantId) : null;

  let membershipReadFailed = false;
  let activeMembershipCount = 0;
  let tenantSelectionRequired = false;
  let invalidTenantSelection = false;
  let tenantOptions: TenantOptionView[] = [];
  let selectedTenantName: string | null = null;

  try {
    const context = await resolveActiveTenantContext(client, identity, requestedTenantId);
    activeMembershipCount = context.memberships.length;
    selectedTenantName =
      context.memberships.find((m) => m.tenantId === context.tenantId)?.tenantName ?? null;
  } catch (error) {
    const classification = classifyTenantSelectionError(error);
    switch (classification.kind) {
      case "no_membership":
        activeMembershipCount = 0;
        break;
      case "selection_required":
        activeMembershipCount = classification.options.length;
        tenantSelectionRequired = true;
        tenantOptions = classification.options;
        break;
      case "invalid_selection":
        // Fails closed with a generic, non-disclosing state. Never retried
        // with a different (or no) candidate id — see the file-level
        // comment above.
        invalidTenantSelection = true;
        break;
      case "unknown":
        membershipReadFailed = true;
        break;
    }
  }

  return (
    <WorkspaceExperience
      model={buildWorkspaceViewModel({
        publicConfigAvailable: true,
        membershipReadFailed,
        isPlatformAdmin: false,
        activeMembershipCount,
        signedInEmail: email,
        tenantSelectionRequired,
        invalidTenantSelection,
        tenantOptions,
        selectedTenantName,
      })}
    />
  );
}
