/** Mirrors the CHECK constraint on public.expenses.category. */
export const EXPENSE_CATEGORIES = [
  'groceries',
  'restaurants',
  'travel',
  'rent',
  'shopping',
  'subscriptions',
  'transport',
  'entertainment',
  'bills',
  'health',
  'miscellaneous',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  groceries: 'Groceries',
  restaurants: 'Restaurants',
  travel: 'Travel',
  rent: 'Rent',
  shopping: 'Shopping',
  subscriptions: 'Subscriptions',
  transport: 'Transport',
  entertainment: 'Entertainment',
  bills: 'Bills',
  health: 'Health',
  miscellaneous: 'Miscellaneous',
};

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}
