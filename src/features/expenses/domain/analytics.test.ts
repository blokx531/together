import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/lib/localDate';
import { filterExpenses, SHOW_ALL_EXPENSES, summarizeSpending } from './analytics';
import { summarizeBalance } from './balance';
import { csvCell, expensesToCsv, settlementsToCsv } from './csv';
import type { Expense } from './types';

const A = 'asha';
const B = 'bilal';

function expense(partial: Partial<Expense> & Pick<Expense, 'amountPaise' | 'payerId'>): Expense {
  const shares =
    partial.shares ??
    (partial.scope === 'personal'
      ? [{ userId: partial.payerId, sharePaise: partial.amountPaise, percentBasisPoints: null }]
      : [
          { userId: A, sharePaise: partial.amountPaise / 2, percentBasisPoints: null },
          { userId: B, sharePaise: partial.amountPaise / 2, percentBasisPoints: null },
        ]);
  return {
    id: crypto.randomUUID(),
    createdBy: partial.payerId,
    scope: 'shared',
    visibility: 'household',
    splitMethod: partial.scope === 'personal' ? 'personal' : 'equal',
    category: 'groceries',
    title: 'Item',
    note: null,
    spentOn: '2026-11-21' as LocalDate,
    version: 1,
    ...partial,
    shares,
  };
}

describe('summarizeSpending', () => {
  const expenses = [
    expense({ amountPaise: 120000, payerId: A, category: 'groceries', title: 'Big Basket' }),
    expense({
      amountPaise: 30000,
      payerId: B,
      scope: 'personal',
      category: 'transport',
      title: 'Metro card',
    }),
    expense({ amountPaise: 80000, payerId: B, category: 'restaurants', title: 'Dinner' }),
  ];

  it('counts each shared expense once in the combined total', () => {
    const summary = summarizeSpending(expenses);
    expect(summary.totalPaise).toBe(230000);
    expect(summary.sharedPaise).toBe(200000);
    expect(summary.count).toBe(3);
  });

  it('separates who paid from who consumed', () => {
    const summary = summarizeSpending(expenses);
    expect(summary.byPerson.get(A)).toEqual({ paidPaise: 120000, sharePaise: 100000 });
    expect(summary.byPerson.get(B)).toEqual({ paidPaise: 110000, sharePaise: 130000 });
  });

  it('orders categories by total and lists the largest expenses', () => {
    const summary = summarizeSpending(expenses);
    expect(summary.byCategory.map((c) => c.category)).toEqual([
      'groceries',
      'restaurants',
      'transport',
    ]);
    expect(summary.largest[0]?.title).toBe('Big Basket');
  });

  it('handles an empty period', () => {
    expect(summarizeSpending([])).toMatchObject({
      totalPaise: 0,
      sharedPaise: 0,
      count: 0,
      byCategory: [],
    });
  });
});

describe('filterExpenses', () => {
  const list = [
    expense({ amountPaise: 100, payerId: A, title: 'Milk', note: 'Amul' }),
    expense({
      amountPaise: 200,
      payerId: B,
      title: 'Cab',
      scope: 'personal',
      category: 'transport',
    }),
  ];
  it('shows every expense with the default filter (regression: list rendered empty)', () => {
    expect(filterExpenses(list, SHOW_ALL_EXPENSES)).toHaveLength(list.length);
  });

  it('filters by text in title or note, scope, category and payer', () => {
    const base = SHOW_ALL_EXPENSES;
    expect(filterExpenses(list, { ...base, text: 'amul' }).map((e) => e.title)).toEqual(['Milk']);
    expect(filterExpenses(list, { ...base, scope: 'personal' }).map((e) => e.title)).toEqual([
      'Cab',
    ]);
    expect(filterExpenses(list, { ...base, category: 'transport' })).toHaveLength(1);
    expect(filterExpenses(list, { ...base, payerId: A })).toHaveLength(1);
  });
});

describe('summarizeBalance', () => {
  const balance = (userId: string, netPaise: number) => ({
    userId,
    netPaise,
    paidPaise: 0,
    sharePaise: 0,
    settlementsPaidPaise: 0,
    settlementsReceivedPaise: 0,
  });
  it('reads the net from the viewer side', () => {
    const balances = [balance(A, 60000), balance(B, -60000)];
    expect(summarizeBalance(balances, A)).toEqual({
      kind: 'you-are-owed',
      amountPaise: 60000,
      debtorId: B,
    });
    expect(summarizeBalance(balances, B)).toEqual({
      kind: 'you-owe',
      amountPaise: 60000,
      creditorId: A,
    });
  });
  it('is settled at zero or without a partner', () => {
    expect(summarizeBalance([balance(A, 0), balance(B, 0)], A)).toEqual({ kind: 'settled' });
    expect(summarizeBalance([balance(A, 0)], A)).toEqual({ kind: 'settled' });
  });
});

describe('CSV export', () => {
  it('escapes quotes, commas and spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-5')).toBe("'-5");
  });

  it('writes exact rupee amounts and names', () => {
    const names = (id: string) => (id === A ? 'Asha' : 'Bilal');
    const csv = expensesToCsv(
      [
        expense({
          amountPaise: 120050,
          payerId: A,
          title: 'Veg, fruit',
          shares: [
            { userId: A, sharePaise: 60025, percentBasisPoints: null },
            { userId: B, sharePaise: 60025, percentBasisPoints: null },
          ],
        }),
      ],
      names,
    );
    expect(csv).toContain(
      '"Veg, fruit",Groceries,1200.50,Asha,shared,equal,Asha: 600.25; Bilal: 600.25',
    );
    const settlementsCsv = settlementsToCsv(
      [
        {
          id: 's',
          fromUserId: B,
          toUserId: A,
          amountPaise: 60000,
          settledOn: '2026-11-22' as LocalDate,
          note: null,
        },
      ],
      names,
    );
    expect(settlementsCsv.split('\r\n')[1]).toBe('2026-11-22,Bilal,Asha,600.00,');
  });
});
