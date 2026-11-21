import { Lock } from 'lucide-react';
import { memberName, useHousehold, type HouseholdContextValue } from '@/features/household';
import { describeDay, type LocalDate } from '@/shared/lib/localDate';
import { formatPaise } from '@/shared/lib/money';
import { Avatar } from '@/shared/ui/Avatar';
import { CATEGORY_LABELS } from '../domain/categories';
import type { Expense } from '../domain/types';

function relationText(expense: Expense, household: HouseholdContextValue): string {
  if (expense.scope === 'personal') return 'Personal';
  const meId = household.me.userId;
  const myShare = expense.shares.find((s) => s.userId === meId)?.sharePaise ?? 0;
  if (expense.payerId === meId) {
    const lent = expense.amountPaise - myShare;
    return lent > 0 ? `You lent ${formatPaise(lent)}` : 'You covered it';
  }
  return myShare > 0
    ? `You owe ${formatPaise(myShare)}`
    : `${memberName(household, expense.payerId)} covered it`;
}

function groupByDay(expenses: readonly Expense[]): [LocalDate, Expense[]][] {
  const groups = new Map<LocalDate, Expense[]>();
  for (const expense of expenses) {
    const group = groups.get(expense.spentOn);
    if (group) group.push(expense);
    else groups.set(expense.spentOn, [expense]);
  }
  return [...groups.entries()];
}

interface ExpenseListProps {
  expenses: readonly Expense[];
  today: LocalDate;
  onOpen: (expense: Expense) => void;
}

export function ExpenseList({ expenses, today, onOpen }: ExpenseListProps) {
  const household = useHousehold();
  return (
    <div className="flex flex-col gap-4">
      {groupByDay(expenses).map(([day, items]) => (
        <section key={day} aria-label={describeDay(day, today)}>
          <h3 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
            {describeDay(day, today)}
          </h3>
          <ul className="overflow-hidden rounded-card border border-line bg-surface">
            {items.map((expense) => {
              const payerTone = expense.payerId === household.me.userId ? 'me' : 'partner';
              return (
                <li key={expense.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      onOpen(expense);
                    }}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
                  >
                    <Avatar
                      name={memberName(household, expense.payerId)}
                      tone={payerTone}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="truncate">{expense.title}</span>
                        {expense.visibility === 'private' ? (
                          <Lock
                            className="size-3.5 shrink-0 text-ink-subtle"
                            aria-label="Private"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-sm text-ink-muted">
                        {CATEGORY_LABELS[expense.category]} · {relationText(expense, household)}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatPaise(expense.amountPaise)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
