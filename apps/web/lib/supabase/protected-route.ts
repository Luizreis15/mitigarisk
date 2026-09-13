import { redirect } from "next/navigation";
import type { RequestIdentity } from "../domain/identity";
import { createServerSupabaseClient } from "./session.ts";
import { resolveRequestIdentity } from "./identity.ts";

// The server-side route-protection primitive
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md, "Add
// server-side protected-route handling for authenticated product
// routes"). A Server Component for an authenticated route calls this
// first; it never returns without a verified identity — a missing,
// expired, or invalid session redirects to the safe sign-in state
// (`/`) rather than rendering anything, and never infers identity from a
// client-supplied role, tenant id, or query parameter.
export async function requireAuthenticatedIdentity(): Promise<RequestIdentity> {
  const client = await createServerSupabaseClient();
  try {
    return await resolveRequestIdentity(client);
  } catch {
    redirect("/");
  }
}
