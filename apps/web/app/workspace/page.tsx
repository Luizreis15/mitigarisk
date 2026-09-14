import { WorkspaceExperience } from '@/components/workspace/workspace-experience';
import { buildWorkspaceViewModel } from '@/lib/domain/workspace-access';
import { hasPublicSupabaseConfig } from '@/lib/supabase/env';
import { requireAuthenticatedIdentity } from '@/lib/supabase/protected-route';
import { createServerSupabaseClient } from '@/lib/supabase/session';

// Real protected product route
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md and
// docs/tasks/TASK-018-cursor-authenticated-workspace-experience.md).
// requireAuthenticatedIdentity() fails closed before authenticated content
// renders. Presentation receives only server-derived values and never infers
// tenant context, roles, or capabilities.
export default async function WorkspacePage() {
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

  let activeMembershipCount = 0;
  let membershipReadFailed = false;
  if (!identity.isPlatformAdmin) {
    const { data, error } = await client
      .from('memberships')
      .select('id')
      .eq('user_id', identity.userId)
      .eq('status', 'active');
    if (error) {
      membershipReadFailed = true;
    } else {
      activeMembershipCount = data?.length ?? 0;
    }
  }

  const { data: userData } = await client.auth.getUser();
  const email = userData.user?.email ?? null;

  return (
    <WorkspaceExperience
      model={buildWorkspaceViewModel({
        publicConfigAvailable: true,
        membershipReadFailed,
        isPlatformAdmin: identity.isPlatformAdmin,
        activeMembershipCount,
        signedInEmail: email,
      })}
    />
  );
}
