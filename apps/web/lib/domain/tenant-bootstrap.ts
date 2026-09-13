// Pure input validation for public.bootstrap_tenant() (see
// supabase/migrations/20260913090000_auth_tenant_bootstrap.sql). This is a
// pre-check for a clean, early error message only; the database is the real
// source of truth (the tenants.slug UNIQUE constraint, in particular, cannot
// be replicated here).

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_SLUG_LENGTH = 2;
const MAX_SLUG_LENGTH = 63;
const MAX_NAME_LENGTH = 200;

export function assertValidTenantSlug(slug: string): void {
  if (
    slug.length < MIN_SLUG_LENGTH ||
    slug.length > MAX_SLUG_LENGTH ||
    !SLUG_RE.test(slug)
  ) {
    throw new Error(
      `Invalid tenant slug "${slug}": expected ${MIN_SLUG_LENGTH}-${MAX_SLUG_LENGTH} lowercase letters, digits, or single hyphens`,
    );
  }
}

export function assertValidTenantName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Invalid tenant name: must be 1-${MAX_NAME_LENGTH} characters`);
  }
}
