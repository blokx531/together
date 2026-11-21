import { X } from 'lucide-react';
import { memberName, useHousehold } from '@/features/household';
import { formatLocalDate } from '@/shared/lib/localDate';
import { formatPaise } from '@/shared/lib/money';
import { IconButton } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useToast } from '@/shared/ui/Toast';
import { setSettlementVoided } from '../data/expensesApi';
import type { Settlement } from '../domain/types';

interface SettlementListProps {
  settlements: readonly Settlement[];
  onChanged: () => void;
}

export function SettlementList({ settlements, onChanged }: SettlementListProps) {
  const household = useHousehold();
  const toast = useToast();
  if (settlements.length === 0) return null;

  const onRemove = (settlement: Settlement) => {
    setSettlementVoided(settlement.id, true).then(
      () => {
        onChanged();
        toast.show('Settlement removed', {
          action: {
            label: 'Undo',
            onAction: () => {
              setSettlementVoided(settlement.id, false).then(onChanged, () => {
                toast.show('Could not restore the settlement.', { tone: 'error' });
              });
            },
          },
        });
      },
      () => {
        toast.show('Could not remove the settlement. Try again.', { tone: 'error' });
      },
    );
  };

  return (
    <Card title="Settlements this month">
      <ul className="flex flex-col">
        {settlements.map((settlement) => {
          const label = `${memberName(household, settlement.fromUserId)} paid ${memberName(household, settlement.toUserId)}`;
          return (
            <li
              key={settlement.id}
              className="flex items-center gap-3 border-t border-line py-2 first:border-t-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-ink-muted">
                  {formatLocalDate(settlement.settledOn, 'day-month')}
                  {settlement.note ? ` · ${settlement.note}` : ''}
                </span>
              </span>
              <span className="font-semibold tabular-nums">
                {formatPaise(settlement.amountPaise)}
              </span>
              <IconButton
                label={`Remove settlement: ${label}`}
                onClick={() => {
                  onRemove(settlement);
                }}
              >
                <X className="size-4" aria-hidden />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
