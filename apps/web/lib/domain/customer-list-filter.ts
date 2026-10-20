import type { CraBandName } from './cra-engine.ts';
import type { Customer } from './customer.ts';
import type { CustomerAssessment } from './customer-assessment.ts';

export type CustomerListBandFilter = 'ALL' | CraBandName | 'UNASSESSED';

export interface CustomerListFilterRow {
  customer: Customer;
  latest: CustomerAssessment | null;
}

export interface CustomerListFilterInput {
  query: string;
  band: CustomerListBandFilter;
}

/**
 * Client-side portfolio filter for the dense Customers list.
 * Matches name / external reference only — never invents an assessment band.
 */
export function filterCustomerListRows(
  rows: CustomerListFilterRow[],
  input: CustomerListFilterInput,
): CustomerListFilterRow[] {
  const needle = input.query.trim().toLocaleLowerCase();
  return rows.filter(({ customer, latest }) => {
    if (input.band === 'UNASSESSED') {
      if (latest) return false;
    } else if (input.band !== 'ALL') {
      if (!latest || latest.band !== input.band) return false;
    }
    if (!needle) return true;
    const haystack = `${customer.fullName} ${customer.externalReference}`.toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export function summarizeCustomerListRows(rows: CustomerListFilterRow[]) {
  let low = 0;
  let medium = 0;
  let high = 0;
  let unassessed = 0;
  for (const { latest } of rows) {
    if (!latest) {
      unassessed += 1;
      continue;
    }
    if (latest.band === 'LOW') low += 1;
    else if (latest.band === 'MEDIUM') medium += 1;
    else high += 1;
  }
  return { total: rows.length, low, medium, high, unassessed };
}
