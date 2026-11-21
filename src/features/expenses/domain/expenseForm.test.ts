import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/lib/localDate';
import {
  beneficiaryOptions,
  type FormPeople,
  defaultFormValues,
  formValuesFromExpense,
  resolveExpenseForm,
  type ExpenseFormValues,
} from './expenseForm';
import type { Expense } from './types';

const ME = 'me-id';
const PARTNER = 'partner-id';
const people = { meId: ME, partnerId: PARTNER };
const today = '2026-11-21' as LocalDate;

function form(overrides: Partial<ExpenseFormValues>): ExpenseFormValues {
  return { ...defaultFormValues(today), ...overrides };
}

function errorsOf(values: ExpenseFormValues) {
  const result = resolveExpenseForm(values, people);
  if (result.ok) throw new Error('expected validation errors');
  return result.errors;
}

function draftOf(values: ExpenseFormValues, who: FormPeople = people) {
  const result = resolveExpenseForm(values, who);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.draft;
}

describe('resolveExpenseForm', () => {
  it('maps "I paid, split equally" to a shared equal split', () => {
    const draft = draftOf(form({ amountInput: '1200' }));
    expect(draft).toMatchObject({
      payerId: ME,
      scope: 'shared',
      visibility: 'household',
      splitMethod: 'equal',
      amountPaise: 120000,
    });
  });

  it('maps "I paid, only for me" to a private personal expense by default', () => {
    const draft = draftOf(form({ amountInput: '45', forWhom: 'me' }));
    expect(draft).toMatchObject({
      scope: 'personal',
      visibility: 'private',
      splitMethod: 'personal',
    });
    expect(
      draftOf(form({ amountInput: '45', forWhom: 'me', showToPartner: true })).visibility,
    ).toBe('household');
  });

  it('maps "partner paid for me" to other_only with the partner as payer', () => {
    const draft = draftOf(form({ amountInput: '300', paidBy: 'partner', forWhom: 'me' }));
    expect(draft).toMatchObject({ payerId: PARTNER, scope: 'shared', splitMethod: 'other_only' });
    expect(draft.shares).toEqual([
      { userId: PARTNER, sharePaise: 0, percentBasisPoints: null },
      { userId: ME, sharePaise: 30000, percentBasisPoints: null },
    ]);
  });

  it('interprets custom and percentage shares from my side even when the partner paid', () => {
    const exact = draftOf(
      form({ amountInput: '1000', paidBy: 'partner', bothMethod: 'exact', myShareInput: '300' }),
    );
    expect(exact.shares.find((s) => s.userId === ME)?.sharePaise).toBe(30000);
    const percent = draftOf(
      form({ amountInput: '1000', paidBy: 'partner', bothMethod: 'percent', myPercentInput: '25' }),
    );
    expect(percent.shares.find((s) => s.userId === ME)).toMatchObject({
      sharePaise: 25000,
      percentBasisPoints: 2500,
    });
  });

  it('reports field errors', () => {
    expect(Object.keys(errorsOf(form({ amountInput: '' })))).toEqual(['amount']);
    expect(Object.keys(errorsOf(form({ amountInput: '0' })))).toEqual(['amount']);
    expect(
      Object.keys(errorsOf(form({ amountInput: '100', bothMethod: 'exact', myShareInput: '150' }))),
    ).toEqual(['myShare']);
    expect(
      Object.keys(
        errorsOf(form({ amountInput: '100', bothMethod: 'percent', myPercentInput: '120' })),
      ),
    ).toEqual(['myPercent']);
  });

  it('forces personal expenses when there is no partner yet', () => {
    const draft = draftOf(form({ amountInput: '99', paidBy: 'partner', forWhom: 'both' }), {
      meId: ME,
      partnerId: null,
    });
    expect(draft).toMatchObject({ payerId: ME, scope: 'personal' });
  });
});

describe('beneficiaryOptions', () => {
  it("does not offer logging the partner's own purchase", () => {
    expect(beneficiaryOptions('partner', true)).toEqual(['both', 'me']);
    expect(beneficiaryOptions('me', true)).toEqual(['both', 'me', 'partner']);
    expect(beneficiaryOptions('me', false)).toEqual(['me']);
  });
});

describe('formValuesFromExpense', () => {
  const base: Expense = {
    id: 'e1',
    createdBy: PARTNER,
    payerId: PARTNER,
    scope: 'shared',
    visibility: 'household',
    splitMethod: 'percent',
    amountPaise: 100000,
    category: 'restaurants',
    title: 'Dinner',
    note: null,
    spentOn: today,
    version: 3,
    shares: [
      { userId: PARTNER, sharePaise: 66670, percentBasisPoints: 6667 },
      { userId: ME, sharePaise: 33330, percentBasisPoints: 3333 },
    ],
  };

  it('round-trips a percent split from the viewer perspective', () => {
    const values = formValuesFromExpense(base, people);
    expect(values).toMatchObject({
      paidBy: 'partner',
      forWhom: 'both',
      bothMethod: 'percent',
      myPercentInput: '33.33',
      amountInput: '1000',
    });
    expect(draftOf(values).shares).toEqual(base.shares);
  });

  it('round-trips "paid for the other person"', () => {
    const expense: Expense = {
      ...base,
      splitMethod: 'other_only',
      payerId: ME,
      shares: [
        { userId: ME, sharePaise: 0, percentBasisPoints: null },
        { userId: PARTNER, sharePaise: 100000, percentBasisPoints: null },
      ],
    };
    const values = formValuesFromExpense(expense, people);
    expect(values).toMatchObject({ paidBy: 'me', forWhom: 'partner' });
    expect(draftOf(values).splitMethod).toBe('other_only');
  });
});
