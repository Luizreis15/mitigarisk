import { WorkspaceExperience } from '@/components/workspace/workspace-experience';
import { buildWorkspaceViewModel } from '@/lib/domain/workspace-access';
import type { TenantMembershipOption } from '@/lib/domain/tenant-selection';
import {
  InvalidTenantSelectionError,
  NoActiveTenantMembershipError,
  TenantSelectionRequiredError,
} from '@/lib/domain/tenant-selection';
import { isUuid } from '@/lib/domain/ids';
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
// renders. The `tenant` query param is never trusted on its own: it is only
// ever passed to resolveActiveTenantContext(), which proves it against the
// caller's real active memberships, fetched server-side, on every request.
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
    // Platform status is handled explicitly and never falls through to
    // tenant-membership resolution: it does not silently grant entry to a
    // tenant operational workspace (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md,
    // "Keep platform-administrator handling explicit").
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
  const requestedTenantId = rawTenant && isUuid(rawTenant) ? (rawTenant as TenantId) : null;

  let membershipReadFailed = false;
  let activeMembershipCount = 0;
  let tenantSelectionRequired = false;
  let tenantOptions: TenantMembershipOption[] = [];
  let selectedTenantName: string | null = null;

  try {
    const context = await resolveActiveTenantContext(client, identity, requestedTenantId);
    activeMembershipCount = context.memberships.length;
    selectedTenantName =
      context.memberships.find((m) => m.tenantId === context.tenantId)?.tenantName ?? null;
  } catch (error) {
    if (error instanceof NoActiveTenantMembershipError) {
      activeMembershipCount = 0;
    } else if (error instanceof TenantSelectionRequiredError) {
      activeMembershipCount = error.options.length;
      tenantSelectionRequired = true;
      tenantOptions = error.options;
    } else if (error instanceof InvalidTenantSelectionError) {
      // A malformed, stale, or cross-tenant id was supplied. Disclose
      // nothing about it: fall back to the same server-verified selection a
      // request with no `tenant` param would get, never revealing whether
      // the requested id exists or belongs to someone else.
      try {
        const fallback = await resolveActiveTenantContext(client, identity, null);
        activeMembershipCount = fallback.memberships.length;
        selectedTenantName =
          fallback.memberships.find((m) => m.tenantId === fallback.tenantId)?.tenantName ?? null;
      } catch (fallbackError) {
        if (fallbackError instanceof TenantSelectionRequiredError) {
          activeMembershipCount = fallbackError.options.length;
          tenantSelectionRequired = true;
          tenantOptions = fallbackError.options;
        } else if (fallbackError instanceof NoActiveTenantMembershipError) {
          activeMembershipCount = 0;
        } else {
          membershipReadFailed = true;
        }
      }
    } else {
      membershipReadFailed = true;
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
        tenantOptions: tenantOptions.map((option) => ({
          tenantId: option.tenantId,
          tenantName: option.tenantName,
          tenantSlug: option.tenantSlug,
        })),
        selectedTenantName,
      })}
    />
  );
}
