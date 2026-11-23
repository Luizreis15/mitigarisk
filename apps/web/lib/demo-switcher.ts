// Test-environment role switcher: one-click sign-in as a dedicated demo
// account per role, so a reviewer can move between the views the system
// has. It never touches real accounts. Server-only: the demo password and
// the access code live in server environment variables and are never sent
// to the browser.
//
// Enabled only when ALL of these are set on the server:
//   DEMO_ROLE_SWITCHER=true
//   DEMO_ACCESS_CODE=<shared test-environment code>
//   DEMO_ACCOUNTS_PASSWORD=<password of the demo accounts>
// Remove any of them to turn the switcher off (fails closed).

export type DemoRoleKey = 'platform_super_admin' | 'tenant_admin' | 'risk_analyst' | 'operator' | 'auditor';

export type DemoRole = {
  key: DemoRoleKey;
  label: string;
  description: string;
  email: string;
};

export const DEMO_ROLES: readonly DemoRole[] = [
  {
    key: 'tenant_admin',
    label: 'Company owner / MLRO',
    description: 'Publishes policy, approves high-risk and EDD cases, records the final decision.',
    email: 'demo.owner@mitiga.online',
  },
  {
    key: 'risk_analyst',
    label: 'Compliance analyst',
    description: 'Creates and reviews assessments, prepares cases for the MLRO.',
    email: 'demo.analyst@mitiga.online',
  },
  {
    key: 'operator',
    label: 'Onboarding operator',
    description: 'Submits customer data and follows the required actions.',
    email: 'demo.operator@mitiga.online',
  },
  {
    key: 'auditor',
    label: 'Auditor',
    description: 'Read-only access to customers, results and the audit trail.',
    email: 'demo.auditor@mitiga.online',
  },
  {
    key: 'platform_super_admin',
    label: 'MITIGA platform admin',
    description: 'MITIGA staff view across tenants.',
    email: 'demo.platform@mitiga.online',
  },
];

export const DEMO_ACCESS_COOKIE = 'mitiga-demo-access';
export const DEMO_ACCESS_MAX_AGE_SECONDS = 12 * 60 * 60;

type Env = Record<string, string | undefined>;

export function isDemoSwitcherEnabled(env: Env = process.env): boolean {
  return (
    env.DEMO_ROLE_SWITCHER === 'true' &&
    (env.DEMO_ACCESS_CODE ?? '').length >= 8 &&
    (env.DEMO_ACCOUNTS_PASSWORD ?? '').length >= 12
  );
}

export function findDemoRole(key: string): DemoRole | null {
  return DEMO_ROLES.find((role) => role.key === key) ?? null;
}

// The cookie stores a digest of the access code, never the code itself, so
// rotating DEMO_ACCESS_CODE invalidates every unlocked browser at once.
export async function demoAccessToken(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`mitiga-demo-access:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isDemoAccessCookieValid(
  cookieValue: string | undefined,
  env: Env = process.env,
): Promise<boolean> {
  if (!isDemoSwitcherEnabled(env) || !cookieValue) return false;
  return timingSafeEqualStrings(cookieValue, await demoAccessToken(env.DEMO_ACCESS_CODE as string));
}
