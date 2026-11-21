import { paiseToDecimalString } from '@/shared/lib/money';
import { CATEGORY_LABELS } from './categories';
import type { Expense, Settlement } from './types';

/**
 * Escapes one CSV cell (RFC 4180). Cells that a spreadsheet would treat as a formula are prefixed
 * with an apostrophe so an exported note like "=HYPERLINK(...)" cannot execute when opened.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

type NameOf = (userId: string) => string;

export function expensesToCsv(expenses: readonly Expense[], nameOf: NameOf): string {
  return toCsv(
    [
      'Date',
      'Title',
      'Category',
      'Amount (INR)',
      'Paid by',
      'Type',
      'Split',
      'Shares',
      'Visibility',
      'Note',
    ],
    expenses.map((e) => [
      e.spentOn,
      e.title,
      CATEGORY_LABELS[e.category],
      paiseToDecimalString(e.amountPaise),
      nameOf(e.payerId),
      e.scope,
      e.splitMethod,
      e.shares.map((s) => `${nameOf(s.userId)}: ${paiseToDecimalString(s.sharePaise)}`).join('; '),
      e.visibility,
      e.note ?? '',
    ]),
  );
}

export function settlementsToCsv(settlements: readonly Settlement[], nameOf: NameOf): string {
  return toCsv(
    ['Date', 'From', 'To', 'Amount (INR)', 'Note'],
    settlements.map((s) => [
      s.settledOn,
      nameOf(s.fromUserId),
      nameOf(s.toUserId),
      paiseToDecimalString(s.amountPaise),
      s.note ?? '',
    ]),
  );
}
