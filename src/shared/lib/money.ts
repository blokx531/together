/**
 * Money is always an integer number of paise (1 rupee = 100 paise). Rupee strings exist only at
 * the edges: parsing user input and formatting for display.
 */
export const PAISE_PER_RUPEE = 100;

/** Upper bound for one amount: ₹10 crore. Mirrors the database CHECK constraints. */
export const MAX_AMOUNT_PAISE = 10_000_000_000;

const AMOUNT_INPUT = /^(\d{1,3}(?:,\d{2,3})*|\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses "1200", "1,200.5", "₹ 12,00,000" into paise without floating-point arithmetic.
 * Returns null for anything else, including negative numbers and more than two decimals.
 */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹\s]/g, '');
  const match = AMOUNT_INPUT.exec(cleaned);
  if (!match) return null;
  const rupees = (match[1] ?? '').replace(/,/g, '');
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const paise = Number(rupees) * PAISE_PER_RUPEE + Number(fraction);
  if (!Number.isSafeInteger(paise) || paise > MAX_AMOUNT_PAISE) return null;
  return paise;
}

const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const withPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "₹1,200" for whole rupees, "₹600.50" otherwise. Indian digit grouping (₹12,00,000). */
export function formatPaise(paise: number): string {
  const formatter = paise % PAISE_PER_RUPEE === 0 ? wholeRupees : withPaise;
  return formatter.format(paise / PAISE_PER_RUPEE);
}

/** Plain editable value for an input field: 120050 -> "1200.50". */
export function paiseToInputValue(paise: number): string {
  const rupees = Math.trunc(paise / PAISE_PER_RUPEE);
  const rest = Math.abs(paise % PAISE_PER_RUPEE);
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`;
}

/** Exact decimal rupees for exports: 120050 -> "1200.50". */
export function paiseToDecimalString(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / PAISE_PER_RUPEE);
  const rest = absolute % PAISE_PER_RUPEE;
  return `${sign}${rupees}.${String(rest).padStart(2, '0')}`;
}
