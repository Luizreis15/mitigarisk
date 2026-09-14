const LOCAL_SITE_URL = 'http://localhost:3000';

function normalizeOrigin(value: string): string {
  const candidate = value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://${value}`;
  const url = new URL(candidate);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Site URL must use HTTP or HTTPS');
  }
  return url.origin;
}

type SiteEnvironment = Readonly<Record<string, string | undefined>>;

export function getSiteOrigin(environment: SiteEnvironment = process.env): string {
  const configured = environment.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return normalizeOrigin(configured);

  const production = environment.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return normalizeOrigin(production);

  const preview = environment.VERCEL_URL?.trim();
  if (preview) return normalizeOrigin(preview);

  return LOCAL_SITE_URL;
}

export function getAuthConfirmUrl(environment: SiteEnvironment = process.env): string {
  return `${getSiteOrigin(environment)}/auth/confirm`;
}

export function safeAuthDestination(value: string | null): '/update-password' | '/workspace' {
  return value === '/workspace' ? '/workspace' : '/update-password';
}

// TASK-022 security review: the callback route must only ever call
// verifyOtp() for a type this application actually issues links for — the
// three flows the four applied templates cover (confirmation, invite,
// recovery; password-changed is a notification with no token). Supabase's
// own EmailOtpType also includes 'magiclink', 'email_change', and 'email',
// none of which this project enables or has a template for
// (docs/tasks/TASK-022-codex-auth-email-and-password-completion.md's "Não
// ative outros provedores de login... magic link... MFA"); excluding them
// here is least-privilege even though this project's Auth settings do not
// enable those flows either, so this callback can never be pointed at a
// login mechanism it was not built to handle.
const SUPPORTED_AUTH_CALLBACK_TYPES = new Set(['recovery', 'invite', 'signup'] as const);

export type SupportedAuthCallbackType = 'recovery' | 'invite' | 'signup';

export function isSupportedAuthCallbackType(value: string | null): value is SupportedAuthCallbackType {
  if (value === null) return false;
  return (SUPPORTED_AUTH_CALLBACK_TYPES as ReadonlySet<string>).has(value);
}

/** True only for the two callback types that gate entry to /update-password. */
export function isPasswordActionCallbackType(
  value: SupportedAuthCallbackType,
): value is 'recovery' | 'invite' {
  return value === 'recovery' || value === 'invite';
}
