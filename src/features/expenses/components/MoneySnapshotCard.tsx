import { Link } from 'wouter';
import { memberName, useHousehold } from '@/features/household';
import { monthRange, todayIn } from '@/shared/lib/localDate';
import { formatPaise } from '@/shared/lib/money';
import { useResource } from '@/shared/lib/useResource';
import { Card } from '@/shared/ui/Card';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { listExpenses, loadBalances } from '../data/expensesApi';
import { summarizeSpending } from '../domain/analytics';
import { summarizeBalance } from '../domain/balance';

/** Home-screen summary: this month's visible spending and the current balance. */
export function MoneySnapshotCard() {
  const household = useHousehold();
  const range = monthRange(todayIn(household.timeZone, new Date()));
  const data = useResource(`home-money:${range.start}`, async (signal) => {
    const [page, balances] = await Promise.all([listExpenses(range, signal), loadBalances(signal)]);
    return {
      summary: summarizeSpending(page.expenses),
      balance: summarizeBalance(balances, household.me.userId),
    };
  });

  return (
    <Card
      title="Money"
      action={
        <Link href="/money" className="text-sm font-medium text-accent">
          Open
        </Link>
      }
    >
      {data.status === 'loading' ? <Skeleton className="h-12" /> : null}
      {data.status === 'error' ? <ErrorState error={data.error} onRetry={data.reload} /> : null}
      {data.status === 'success' ? (
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-sm text-ink-muted">Spent this month</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {formatPaise(data.data.summary.totalPaise)}
            </dd>
          </div>
          {household.partner ? (
            <div>
              <dt className="text-sm text-ink-muted">Balance</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {data.data.balance.kind === 'settled' ? (
                  <span className="text-positive">Settled</span>
                ) : data.data.balance.kind === 'you-are-owed' ? (
                  <span
                    className="text-positive"
                    title={`${memberName(household, data.data.balance.debtorId)} owes you`}
                  >
                    +{formatPaise(data.data.balance.amountPaise)}
                  </span>
                ) : (
                  <span
                    className="text-negative"
                    title={`You owe ${memberName(household, data.data.balance.creditorId)}`}
                  >
                    −{formatPaise(data.data.balance.amountPaise)}
                  </span>
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </Card>
  );
}
