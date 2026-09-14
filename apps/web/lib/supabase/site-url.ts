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
