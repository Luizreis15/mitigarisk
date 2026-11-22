// Server-only switch for the fixture prototype routes under app/(prototype).
// Off unless explicitly enabled, so a missing variable fails closed.
export function prototypeRoutesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ENABLE_PROTOTYPE_ROUTES === 'true';
}
