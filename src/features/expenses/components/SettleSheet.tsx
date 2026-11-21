import { useState, type SubmitEvent } from 'react';
import { useHousehold } from '@/features/household';
import { parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { paiseToInputValue, parseRupeesToPaise } from '@/shared/lib/money';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';
import { useToast } from '@/shared/ui/Toast';
import { recordSettlement } from '../data/expensesApi';
import type { BalanceSummary } from '../domain/balance';

interface SettleSheetProps {
  open: boolean;
  balance: BalanceSummary;
  today: LocalDate;
  onClose: () => void;
  onChanged: () => void;
}

export function SettleSheet({ open, balance, today, onClose, onChanged }: SettleSheetProps) {
  return (
    <Sheet
      open={open}
      title="Record a settlement"
      description="For your records only. No money is sent."
      onClose={onClose}
    >
      {open ? (
        <SettleForm balance={balance} today={today} onClose={onClose} onChanged={onChanged} />
      ) : null}
    </Sheet>
  );
}

type Direction = 'i-paid' | 'partner-paid';

function SettleForm({ balance, today, onClose, onChanged }: Omit<SettleSheetProps, 'open'>) {
  const household = useHousehold();
  const toast = useToast();
  const partner = household.partner;
  const [requestId] = useState(newRequestId);
  const [direction, setDirection] = useState<Direction>(
    balance.kind === 'you-owe' ? 'i-paid' : 'partner-paid',
  );
  const [amountInput, setAmountInput] = useState(
    balance.kind === 'settled' ? '' : paiseToInputValue(balance.amountPaise),
  );
  const [settledOn, setSettledOn] = useState(today);
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | undefined>();
  const record = useAsyncAction(recordSettlement);

  if (!partner) return null;

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountPaise = parseRupeesToPaise(amountInput);
    if (amountPaise === null || amountPaise === 0) {
      setAmountError('Enter an amount like 600 or 600.50.');
      return;
    }
    setAmountError(undefined);
    const [fromUserId, toUserId] =
      direction === 'i-paid'
        ? [household.me.userId, partner.userId]
        : [partner.userId, household.me.userId];
    const result = await record.run({
      requestId,
      fromUserId,
      toUserId,
      amountPaise,
      settledOn,
      note,
    });
    if (result?.ok) {
      toast.show('Settlement recorded', { tone: 'success' });
      onChanged();
      onClose();
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
      <SegmentedControl<Direction>
        label="Who paid whom"
        options={[
          { value: 'i-paid', label: `You paid ${partner.displayName}` },
          { value: 'partner-paid', label: `${partner.displayName} paid you` },
        ]}
        value={direction}
        onChange={setDirection}
      />
      <TextField
        label="Amount (₹)"
        inputMode="decimal"
        required
        value={amountInput}
        error={amountError}
        onChange={(event) => {
          setAmountInput(event.target.value);
        }}
      />
      <TextField
        label="Date"
        type="date"
        value={settledOn}
        onChange={(event) => {
          const date = parseLocalDate(event.target.value);
          if (date) setSettledOn(date);
        }}
      />
      <TextField
        label="Note (optional)"
        maxLength={500}
        placeholder="e.g. UPI, cash"
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />
      <FormError message={record.error?.message} />
      <Button type="submit" isLoading={record.isPending} fullWidth>
        Record settlement
      </Button>
    </form>
  );
}
