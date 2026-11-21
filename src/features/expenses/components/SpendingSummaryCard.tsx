import { memberName, useHousehold } from '@/features/household';
import { formatPaise } from '@/shared/lib/money';
import { Card } from '@/shared/ui/Card';
import type { SpendingSummary } from '../domain/analytics';
import { CATEGORY_LABELS } from '../domain/categories';

export function SpendingSummaryCard({ summary }: { summary: SpendingSummary }) {
  const household = useHousehold();
  const people = [household.me, household.partner].filter((member) => member !== null);
  const maxCategory = summary.byCategory[0]?.totalPaise ?? 0;

  return (
    <Card title="Spending">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-sm text-ink-muted">Total spent</dt>
          <dd className="text-2xl font-semibold tabular-nums">{formatPaise(summary.totalPaise)}</dd>
        </div>
        {household.partner ? (
          <div>
            <dt className="text-sm text-ink-muted">Together</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {formatPaise(summary.sharedPaise)}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-1 text-xs text-ink-subtle">
        {summary.count} {summary.count === 1 ? 'expense' : 'expenses'} you can see. Shared items are
        counted once; settlements are not spending.
      </p>

      {household.partner ? (
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Paid versus share per person</caption>
          <thead>
            <tr className="text-left text-ink-muted">
              <th scope="col" className="pb-1 font-medium">
                Person
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                Paid
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                Their share
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((member) => {
              const totals = summary.byPerson.get(member.userId);
              return (
                <tr key={member.userId} className="border-t border-line">
                  <th scope="row" className="py-1.5 text-left font-medium">
                    {memberName(household, member.userId)}
                  </th>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatPaise(totals?.paidPaise ?? 0)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatPaise(totals?.sharePaise ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {summary.byCategory.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2" aria-label="Spending by category">
          {summary.byCategory.map((item) => (
            <li key={item.category}>
              <div className="flex justify-between text-sm">
                <span>{CATEGORY_LABELS[item.category]}</span>
                <span className="tabular-nums text-ink-muted">{formatPaise(item.totalPaise)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-2" aria-hidden>
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{
                    width: `${Math.max(2, Math.round((item.totalPaise / maxCategory) * 100))}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
