import type { LocalDate } from '@/shared/lib/localDate';
import { paiseToInputValue, parseRupeesToPaise } from '@/shared/lib/money';
import type { ExpenseCategory } from './categories';
import {
  BASIS_POINTS_PER_WHOLE,
  buildSplit,
  parsePercentToBasisPoints,
  type SplitMethod,
  type SplitRequest,
  type SplitShare,
} from './splits';
import type { Expense, ExpenseScope, ExpenseVisibility } from './types';

/**
 * Translates the expense form (phrased from the viewer's side: "who paid", "who is it for") into
 * the stored representation (payer, scope, split method, shares) and back.
 */
export type Person = 'me' | 'partner';
export type Beneficiary = 'both' | 'me' | 'partner';
export type BothMethod = 'equal' | 'exact' | 'percent' | 'payer_only';

export interface ExpenseFormValues {
  amountInput: string;
  title: string;
  category: ExpenseCategory;
  spentOn: LocalDate;
  paidBy: Person;
  forWhom: Beneficiary;
  bothMethod: BothMethod;
  /** My share in rupees, for "custom amounts". */
  myShareInput: string;
  /** My share in percent, for "percentage". */
  myPercentInput: string;
  /** Only for my personal expenses. */
  showToPartner: boolean;
  note: string;
}

export interface FormPeople {
  meId: string;
  partnerId: string | null;
}

export interface ExpenseDraft {
  payerId: string;
  scope: ExpenseScope;
  visibility: ExpenseVisibility;
  splitMethod: SplitMethod;
  amountPaise: number;
  shares: SplitShare[];
}

export type FormErrors = Partial<Record<'amount' | 'myShare' | 'myPercent', string>>;
export type ResolveResult = { ok: true; draft: ExpenseDraft } | { ok: false; errors: FormErrors };

export function defaultFormValues(
  today: LocalDate,
  category: ExpenseCategory = 'groceries',
): ExpenseFormValues {
  return {
    amountInput: '',
    title: '',
    category,
    spentOn: today,
    paidBy: 'me',
    forWhom: 'both',
    bothMethod: 'equal',
    myShareInput: '',
    myPercentInput: '50',
    showToPartner: false,
    note: '',
  };
}

/** Which "for whom" choices make sense. A partner's own purchases are logged by the partner. */
export function beneficiaryOptions(paidBy: Person, hasPartner: boolean): Beneficiary[] {
  if (!hasPartner) return ['me'];
  return paidBy === 'me' ? ['both', 'me', 'partner'] : ['both', 'me'];
}

export function normalizeForm(values: ExpenseFormValues, hasPartner: boolean): ExpenseFormValues {
  const allowed = beneficiaryOptions(values.paidBy, hasPartner);
  const paidBy = hasPartner ? values.paidBy : 'me';
  return allowed.includes(values.forWhom)
    ? { ...values, paidBy }
    : { ...values, paidBy, forWhom: allowed[0] ?? 'me' };
}

export function resolveExpenseForm(
  rawValues: ExpenseFormValues,
  people: FormPeople,
): ResolveResult {
  const values = normalizeForm(rawValues, people.partnerId !== null);
  const amountPaise = parseRupeesToPaise(values.amountInput);
  if (amountPaise === null || amountPaise === 0) {
    return { ok: false, errors: { amount: 'Enter an amount like 250 or 99.50.' } };
  }

  const { meId, partnerId } = people;
  const payerId = values.paidBy === 'me' || partnerId === null ? meId : partnerId;
  const otherId = payerId === meId ? partnerId : meId;

  let request: SplitRequest;
  let scope: ExpenseScope = 'shared';
  if (values.forWhom === 'me' && payerId === meId) {
    scope = 'personal';
    request = { method: 'personal', amountPaise, payerId, otherId };
  } else if (values.forWhom !== 'both') {
    // Paid entirely for the other person.
    request = { method: 'other_only', amountPaise, payerId, otherId };
  } else if (values.bothMethod === 'exact') {
    const myShare = parseRupeesToPaise(values.myShareInput);
    if (myShare === null || myShare > amountPaise) {
      return { ok: false, errors: { myShare: 'Your share must be between ₹0 and the total.' } };
    }
    request = {
      method: 'exact',
      amountPaise,
      payerId,
      otherId,
      payerSharePaise: payerId === meId ? myShare : amountPaise - myShare,
    };
  } else if (values.bothMethod === 'percent') {
    const myBasisPoints = parsePercentToBasisPoints(values.myPercentInput);
    if (myBasisPoints === null) {
      return { ok: false, errors: { myPercent: 'Enter a percentage from 0 to 100.' } };
    }
    request = {
      method: 'percent',
      amountPaise,
      payerId,
      otherId,
      payerBasisPoints: payerId === meId ? myBasisPoints : BASIS_POINTS_PER_WHOLE - myBasisPoints,
    };
  } else {
    request = { method: values.bothMethod, amountPaise, payerId, otherId };
  }

  const split = buildSplit(request);
  if (!split.ok) return { ok: false, errors: { amount: 'This split is not valid.' } };
  return {
    ok: true,
    draft: {
      payerId,
      scope,
      visibility: scope === 'personal' && !values.showToPartner ? 'private' : 'household',
      splitMethod: request.method,
      amountPaise,
      shares: split.shares,
    },
  };
}

function basisPointsToInput(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0
    ? String(whole)
    : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}

export function formValuesFromExpense(expense: Expense, people: FormPeople): ExpenseFormValues {
  const paidBy: Person = expense.payerId === people.meId ? 'me' : 'partner';
  const myShare = expense.shares.find((s) => s.userId === people.meId);
  const base: ExpenseFormValues = {
    ...defaultFormValues(expense.spentOn, expense.category),
    amountInput: paiseToInputValue(expense.amountPaise),
    title: expense.title,
    note: expense.note ?? '',
    paidBy,
    showToPartner: expense.visibility === 'household',
  };
  switch (expense.splitMethod) {
    case 'personal':
      return { ...base, paidBy: 'me', forWhom: 'me' };
    case 'other_only':
      return { ...base, forWhom: paidBy === 'me' ? 'partner' : 'me' };
    case 'exact':
      return {
        ...base,
        bothMethod: 'exact',
        myShareInput: paiseToInputValue(myShare?.sharePaise ?? 0),
      };
    case 'percent':
      return {
        ...base,
        bothMethod: 'percent',
        myPercentInput: basisPointsToInput(myShare?.percentBasisPoints ?? 0),
      };
    case 'equal':
    case 'payer_only':
      return { ...base, bothMethod: expense.splitMethod };
  }
}
