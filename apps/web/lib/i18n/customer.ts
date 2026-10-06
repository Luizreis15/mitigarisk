import { messages } from './messages.ts';
import { humanizeCode } from './customer-assessment.ts';

const t = messages.customerWorkspace;

function label(catalog: Record<string, string>, code: string): string {
  return Object.hasOwn(catalog, code) ? catalog[code] : humanizeCode(code);
}

/** Catalog label for a customer status, with a readable fallback for a status added later. */
export function customerStatusLabel(status: string): string {
  return label(t.statusValues, status);
}

/** Catalog label for an onboarding channel, with a readable fallback for a channel added later. */
export function onboardingChannelLabel(channel: string): string {
  return label(t.onboardingChannels, channel);
}
