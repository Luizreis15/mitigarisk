// Transaction trigger checks (supabase/migrations/20261125100000_transaction_triggers.sql).
// The database evaluates the MITIGA gambling-industry default ruleset on
// caller-supplied aggregates; this module only shapes the input and reads
// the stored result. It never decides a hit.

export type TriggerCode =
  | 'TRG_500_DEROGATION'
  | 'TRG_2K_180D'
  | 'TRG_AFFORDABILITY'
  | 'TRG_10K_180D_LINKED'
  | 'TRG_30D_AFFORDABILITY';

export type TriggerStatus = 'hit' | 'clear' | 'not_evaluated' | 'covered';

export interface TriggerResult {
  /** A TriggerCode; kept as string so a future ruleset code still renders. */
  code: string;
  status: TriggerStatus;
  metric: number | null;
  threshold: number | null;
  action: string;
  if_not_provided: string;
}

export interface TransactionCheck {
  id: string;
  tenantId: string;
  customerId: string;
  rulesetVersion: string;
  inputs: Record<string, number | boolean | null>;
  results: TriggerResult[];
  hits: string[];
  actions: string[];
  hitCount: number;
  checkedBy: string;
  checkedAt: string;
}

export const AMOUNT_FIELDS = [
  'lifetime_deposits',
  'lifetime_withdrawals',
  'deposits_180d',
  'linked_deposits',
  'linked_withdrawals',
  'sow_deposits',
  'sow_withdrawals',
  'affordability_limit',
  'deposits_30d',
  'declared_monthly_income',
] as const;

export const REQUIRED_AMOUNT_FIELDS = [
  'lifetime_deposits',
  'lifetime_withdrawals',
  'deposits_180d',
  'linked_deposits',
  'linked_withdrawals',
] as const;

export type AmountField = (typeof AMOUNT_FIELDS)[number];
export const TRANSACTION_FORM_FIELDS = [...AMOUNT_FIELDS, 'days_since_registration', 'prior_sow_documents'] as const;

export class InvalidTransactionInputError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'InvalidTransactionInputError';
    this.field = field;
  }
}

const MAX_AMOUNT = 1_000_000_000;

function parseAmount(field: string, raw: string, required: boolean): number | null {
  const text = raw.trim().replace(/[\s,]/g, '');
  if (text === '') {
    if (required) throw new InvalidTransactionInputError(field, 'This amount is required.');
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new InvalidTransactionInputError(field, 'Enter an amount in euros, e.g. 2500 or 2500.50.');
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value > MAX_AMOUNT) {
    throw new InvalidTransactionInputError(field, 'This amount is out of range.');
  }
  return value;
}

/** Builds the RPC input from submitted form strings. Unknown keys are never read. */
export function buildTransactionInputs(read: (name: string) => string): Record<string, number | boolean | null> {
  const inputs: Record<string, number | boolean | null> = {};
  for (const field of AMOUNT_FIELDS) {
    inputs[field] = parseAmount(field, read(field), (REQUIRED_AMOUNT_FIELDS as readonly string[]).includes(field));
  }
  const daysText = read('days_since_registration').trim();
  if (!/^\d{1,5}$/.test(daysText)) {
    throw new InvalidTransactionInputError('days_since_registration', 'Enter the number of days as a whole number.');
  }
  inputs.days_since_registration = Number(daysText);
  inputs.prior_sow_documents = read('prior_sow_documents') === 'true';

  if ((inputs.affordability_limit === null) !== (inputs.sow_deposits === null)) {
    throw new InvalidTransactionInputError(
      inputs.affordability_limit === null ? 'affordability_limit' : 'sow_deposits',
      'Affordability needs both the limit and the deposits since the SOW answer.',
    );
  }
  if ((inputs.declared_monthly_income === null) !== (inputs.deposits_30d === null)) {
    throw new InvalidTransactionInputError(
      inputs.declared_monthly_income === null ? 'declared_monthly_income' : 'deposits_30d',
      'The 30-day rule needs both the declared income and the deposits in the last 30 days.',
    );
  }
  for (const key of Object.keys(inputs)) {
    if (inputs[key] === null) delete inputs[key];
  }
  return inputs;
}
