import type { ExpenseCategory } from './categories';
import type { Expense } from './types';

export interface CategoryTotal {
  category: ExpenseCategory;
  totalPaise: number;
}

export interface PersonTotals {
  /** Money this person paid out (as payer). */
  paidPaise: number;
  /** What this person consumed: the sum of their shares. */
  sharePaise: number;
}

export interface SpendingSummary {
  /** Every visible expense counted once — shared items are not double-counted. */
  totalPaise: number;
  /** Expenses that involve both people. */
  sharedPaise: number;
  byCategory: CategoryTotal[];
  byPerson: Map<string, PersonTotals>;
  largest: Expense[];
  count: number;
}

const LARGEST_COUNT = 3;

/**
 * Aggregates visible expenses for a period. Settlements are deliberately not an input: repaying
 * someone is not spending. Callers pass only non-voided expenses the viewer is allowed to see,
 * so the partner's private personal expenses are never part of these totals.
 */
export function summarizeSpending(expenses: readonly Expense[]): SpendingSummary {
  const categoryTotals = new Map<ExpenseCategory, number>();
  const byPerson = new Map<string, PersonTotals>();
  let totalPaise = 0;
  let sharedPaise = 0;

  const person = (userId: string): PersonTotals => {
    let totals = byPerson.get(userId);
    if (!totals) {
      totals = { paidPaise: 0, sharePaise: 0 };
      byPerson.set(userId, totals);
    }
    return totals;
  };

  for (const expense of expenses) {
    totalPaise += expense.amountPaise;
    if (expense.scope === 'shared') sharedPaise += expense.amountPaise;
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.amountPaise,
    );
    person(expense.payerId).paidPaise += expense.amountPaise;
    for (const share of expense.shares) person(share.userId).sharePaise += share.sharePaise;
  }

  const byCategory = [...categoryTotals.entries()]
    .map(([category, total]) => ({ category, totalPaise: total }))
    .sort((a, b) => b.totalPaise - a.totalPaise || a.category.localeCompare(b.category));

  const largest = [...expenses]
    .sort((a, b) => b.amountPaise - a.amountPaise)
    .slice(0, LARGEST_COUNT);

  return { totalPaise, sharedPaise, byCategory, byPerson, largest, count: expenses.length };
}

export interface ExpenseFilter {
  text: string;
  scope: 'all' | 'shared' | 'personal';
  category: ExpenseCategory | 'all';
  /** Null shows every payer. */
  payerId: string | null;
}

export const SHOW_ALL_EXPENSES: ExpenseFilter = {
  text: '',
  scope: 'all',
  category: 'all',
  payerId: null,
};

export function filterExpenses(expenses: readonly Expense[], filter: ExpenseFilter): Expense[] {
  const needle = filter.text.trim().toLocaleLowerCase();
  return expenses.filter(
    (expense) =>
      (filter.scope === 'all' || expense.scope === filter.scope) &&
      (filter.category === 'all' || expense.category === filter.category) &&
      (filter.payerId === null || expense.payerId === filter.payerId) &&
      (needle === '' ||
        expense.title.toLocaleLowerCase().includes(needle) ||
        (expense.note?.toLocaleLowerCase().includes(needle) ?? false)),
  );
}
