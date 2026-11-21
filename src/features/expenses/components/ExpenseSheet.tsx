import { Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { memberName, useHousehold } from '@/features/household';
import type { AppError } from '@/shared/lib/appError';
import { parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { formatPaise } from '@/shared/lib/money';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, SelectField, TextAreaField, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';
import { useToast } from '@/shared/ui/Toast';
import { saveExpense, setExpenseVoided } from '../data/expensesApi';
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, isExpenseCategory } from '../domain/categories';
import {
  beneficiaryOptions,
  defaultFormValues,
  formValuesFromExpense,
  normalizeForm,
  resolveExpenseForm,
  type Beneficiary,
  type BothMethod,
  type ExpenseDraft,
  type ExpenseFormValues,
  type FormErrors,
} from '../domain/expenseForm';
import { owedToPayer } from '../domain/splits';
import type { Expense } from '../domain/types';

interface ExpenseSheetProps {
  open: boolean;
  /** Null to create a new expense. */
  expense: Expense | null;
  today: LocalDate;
  onClose: () => void;
  onChanged: () => void;
}

export function ExpenseSheet({ open, expense, today, onClose, onChanged }: ExpenseSheetProps) {
  return (
    <Sheet open={open} title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      {open ? (
        <ExpenseForm
          key={expense?.id ?? 'new'}
          expense={expense}
          today={today}
          onClose={onClose}
          onChanged={onChanged}
        />
      ) : null}
    </Sheet>
  );
}

const SAVE_ERRORS: Record<string, string> = {
  STALE_EXPENSE:
    'Your partner changed this expense meanwhile. Close it and open it again to see their version.',
  NOT_FOUND: 'This expense was removed.',
  NOT_ALLOWED: 'Only the person who added a personal expense can change it.',
};

function saveErrorMessage(error: AppError): string {
  return (error.code ? SAVE_ERRORS[error.code] : undefined) ?? error.message;
}

function previewText(draft: ExpenseDraft, meId: string, partnerName: string): string {
  if (draft.scope === 'personal') {
    return draft.visibility === 'private'
      ? 'Personal and private. It does not affect your balance.'
      : `Personal, visible to ${partnerName}. It does not affect your balance.`;
  }
  const owed = owedToPayer(draft.shares, draft.payerId);
  if (owed === 0) return 'Shared spending, fully covered by the payer. No one owes anything.';
  return draft.payerId === meId
    ? `${partnerName} will owe you ${formatPaise(owed)}.`
    : `You will owe ${partnerName} ${formatPaise(owed)}.`;
}

interface ExpenseFormProps {
  expense: Expense | null;
  today: LocalDate;
  onClose: () => void;
  onChanged: () => void;
}

function ExpenseForm({ expense, today, onClose, onChanged }: ExpenseFormProps) {
  const household = useHousehold();
  const toast = useToast();
  const people = { meId: household.me.userId, partnerId: household.partner?.userId ?? null };
  const partnerName = household.partner?.displayName ?? 'your partner';
  const hasPartner = household.partner !== null;
  const [requestId] = useState(newRequestId);
  const [values, setValues] = useState<ExpenseFormValues>(() =>
    expense ? formValuesFromExpense(expense, people) : defaultFormValues(today),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const save = useAsyncAction(saveExpense);
  const voidAction = useAsyncAction(setExpenseVoided);

  const isReadOnly =
    expense !== null && expense.scope === 'personal' && expense.createdBy !== household.me.userId;
  const update = (patch: Partial<ExpenseFormValues>) => {
    setValues((current) => normalizeForm({ ...current, ...patch }, hasPartner));
  };
  const resolved = resolveExpenseForm(values, people);
  const isPersonal = resolved.ok && resolved.draft.scope === 'personal';

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolved.ok) {
      setErrors(resolved.errors);
      return;
    }
    setErrors({});
    const title = values.title.trim() || CATEGORY_LABELS[values.category];
    const result = await save.run({
      requestId,
      existing: expense ? { id: expense.id, version: expense.version } : null,
      ...resolved.draft,
      category: values.category,
      title,
      note: values.note,
      spentOn: values.spentOn,
    });
    if (result?.ok) {
      toast.show(expense ? 'Expense updated' : 'Expense added', { tone: 'success' });
      onChanged();
      onClose();
    }
  };

  const onVoid = async () => {
    if (!expense) return;
    const result = await voidAction.run(expense.id, expense.version, true);
    if (!result?.ok) return;
    onChanged();
    onClose();
    toast.show('Expense deleted', {
      action: {
        label: 'Undo',
        onAction: () => {
          setExpenseVoided(expense.id, expense.version + 1, false).then(onChanged, () => {
            toast.show('Could not restore the expense.', { tone: 'error' });
          });
        },
      },
    });
  };

  if (isReadOnly) {
    return (
      <div className="flex flex-col gap-2 pb-2">
        <p className="text-2xl font-semibold tabular-nums">{formatPaise(expense.amountPaise)}</p>
        <p className="font-medium">{expense.title}</p>
        <p className="text-sm text-ink-muted">
          {memberName(household, expense.createdBy)}&apos;s personal expense ·{' '}
          {CATEGORY_LABELS[expense.category]} · {expense.spentOn}
        </p>
        {expense.note ? <p className="text-sm">{expense.note}</p> : null}
        <p className="mt-2 text-sm text-ink-muted">
          Only {memberName(household, expense.createdBy)} can change it.
        </p>
      </div>
    );
  }

  const forOptions = beneficiaryOptions(values.paidBy, hasPartner).map((value) => ({
    value,
    label: value === 'both' ? 'Both' : value === 'me' ? 'Just you' : `Just ${partnerName}`,
  }));
  const payerName = values.paidBy === 'me' ? 'You' : partnerName;

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Amount (₹)"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        required
        value={values.amountInput}
        error={errors.amount}
        onChange={(event) => {
          update({ amountInput: event.target.value });
        }}
        className="text-2xl font-semibold tabular-nums"
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Category"
          value={values.category}
          onChange={(event) => {
            if (isExpenseCategory(event.target.value)) update({ category: event.target.value });
          }}
        >
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Date"
          type="date"
          required
          value={values.spentOn}
          onChange={(event) => {
            const date = parseLocalDate(event.target.value);
            if (date) update({ spentOn: date });
          }}
        />
      </div>
      <TextField
        label="What was it?"
        maxLength={80}
        placeholder={CATEGORY_LABELS[values.category]}
        value={values.title}
        onChange={(event) => {
          update({ title: event.target.value });
        }}
      />

      {hasPartner ? (
        <>
          <SegmentedControl
            label="Paid by"
            options={[
              { value: 'me', label: 'You paid' },
              { value: 'partner', label: `${partnerName} paid` },
            ]}
            value={values.paidBy}
            onChange={(paidBy) => {
              update({ paidBy });
            }}
          />
          <SegmentedControl<Beneficiary>
            label="Who is it for"
            options={forOptions}
            value={values.forWhom}
            onChange={(forWhom) => {
              update({ forWhom });
            }}
          />
          {values.forWhom === 'both' ? (
            <SelectField
              label="Split"
              value={values.bothMethod}
              onChange={(event) => {
                const method = (['equal', 'exact', 'percent', 'payer_only'] as const).find(
                  (m) => m === event.target.value,
                );
                if (method) update({ bothMethod: method satisfies BothMethod });
              }}
            >
              <option value="equal">Equally</option>
              <option value="exact">Custom amounts</option>
              <option value="percent">By percentage</option>
              <option value="payer_only">{payerName} covers it all</option>
            </SelectField>
          ) : null}
          {values.forWhom === 'both' && values.bothMethod === 'exact' ? (
            <TextField
              label="Your share (₹)"
              inputMode="decimal"
              value={values.myShareInput}
              error={errors.myShare}
              hint={`${partnerName} gets the rest.`}
              onChange={(event) => {
                update({ myShareInput: event.target.value });
              }}
            />
          ) : null}
          {values.forWhom === 'both' && values.bothMethod === 'percent' ? (
            <TextField
              label="Your share (%)"
              inputMode="decimal"
              value={values.myPercentInput}
              error={errors.myPercent}
              hint={`${partnerName} gets the rest. Leftover paise go to the larger fraction.`}
              onChange={(event) => {
                update({ myPercentInput: event.target.value });
              }}
            />
          ) : null}
          {isPersonal ? (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-accent"
                checked={values.showToPartner}
                onChange={(event) => {
                  update({ showToPartner: event.target.checked });
                }}
              />
              Show this personal expense to {partnerName}
            </label>
          ) : null}
        </>
      ) : null}

      <TextAreaField
        label="Note (optional)"
        maxLength={500}
        rows={2}
        value={values.note}
        onChange={(event) => {
          update({ note: event.target.value });
        }}
      />

      {resolved.ok ? (
        <p className="rounded-control bg-surface-2 px-3.5 py-2.5 text-sm" aria-live="polite">
          {previewText(resolved.draft, household.me.userId, partnerName)}
        </p>
      ) : null}
      <FormError
        message={
          save.error
            ? saveErrorMessage(save.error)
            : voidAction.error
              ? saveErrorMessage(voidAction.error)
              : null
        }
      />
      <div className="flex gap-2">
        {expense ? (
          <Button
            variant="secondary"
            icon={<Trash2 className="size-4" aria-hidden />}
            isLoading={voidAction.isPending}
            onClick={() => void onVoid()}
          >
            Delete
          </Button>
        ) : null}
        <Button type="submit" isLoading={save.isPending} className="flex-1">
          {expense ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  );
}
