import { HandCoins } from 'lucide-react';
import { memberName, useHousehold } from '@/features/household';
import { formatPaise } from '@/shared/lib/money';
import type { Resource } from '@/shared/lib/useResource';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { summarizeBalance } from '../domain/balance';
import type { MemberBalance } from '../domain/types';

interface BalanceCardProps {
  balances: Resource<MemberBalance[]>;
  onSettle: () => void;
}

export function BalanceCard({ balances, onSettle }: BalanceCardProps) {
  const household = useHousehold();
  if (!household.partner) return null;

  return (
    <Card title="Between you two">
      {balances.status === 'loading' ? <Skeleton className="h-12" /> : null}
      {balances.status === 'error' ? (
        <ErrorState error={balances.error} onRetry={balances.reload} />
      ) : null}
      {balances.status === 'success'
        ? (() => {
            const summary = summarizeBalance(balances.data, household.me.userId);
            if (summary.kind === 'settled') {
              return <p className="text-lg font-semibold text-positive">All settled up</p>;
            }
            const isOwed = summary.kind === 'you-are-owed';
            const otherName = memberName(household, isOwed ? summary.debtorId : summary.creditorId);
            return (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-muted">
                    {isOwed ? `${otherName} owes you` : `You owe ${otherName}`}
                  </p>
                  <p
                    className={`text-2xl font-semibold tabular-nums ${isOwed ? 'text-positive' : 'text-negative'}`}
                  >
                    {formatPaise(summary.amountPaise)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  icon={<HandCoins className="size-4" aria-hidden />}
                  onClick={onSettle}
                >
                  Settle up
                </Button>
              </div>
            );
          })()
        : null}
      <p className="mt-2 text-xs text-ink-subtle">
        Across all time. Settlements are bookkeeping only — no money moves in the app.
      </p>
    </Card>
  );
}
