import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { prototypeRoutesEnabled } from '@/lib/prototype-routes';

// Fixture-only prototype screens (operator, company, super-admin, cases,
// entities, evaluations, policies, tenants, onboarding, invite, denied).
// They show fictional data and no real session, so they must never be
// reachable in a delivered environment. They stay in the codebase only as
// visual reference while the real role views are built under /workspace.
// Set ENABLE_PROTOTYPE_ROUTES=true locally to browse them.
export default function PrototypeLayout({ children }: { children: ReactNode }) {
  if (!prototypeRoutesEnabled()) {
    notFound();
  }
  return children;
}
