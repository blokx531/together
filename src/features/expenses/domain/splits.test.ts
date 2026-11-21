import { describe, expect, it } from 'vitest';
import { MAX_AMOUNT_PAISE } from '@/shared/lib/money';
import {
  allocateByBasisPoints,
  buildSplit,
  owedToPayer,
  parsePercentToBasisPoints,
  type SplitResult,
} from './splits';

const A = 'asha';
const B = 'bilal';

function shares(result: SplitResult): Record<string, number> {
  if (!result.ok) throw new Error(`split failed: ${result.error}`);
  return Object.fromEntries(result.shares.map((s) => [s.userId, s.sharePaise]));
}

function total(result: SplitResult): number {
  if (!result.ok) throw new Error('split failed');
  return result.shares.reduce((sum, s) => sum + s.sharePaise, 0);
}

describe('buildSplit', () => {
  it('splits ₹1,200 equally: B owes A ₹600', () => {
    const result = buildSplit({ method: 'equal', amountPaise: 120000, payerId: A, otherId: B });
    expect(shares(result)).toEqual({ [A]: 60000, [B]: 60000 });
    if (result.ok) expect(owedToPayer(result.shares, A)).toBe(60000);
  });

  it('gives the odd paisa of an equal split to the payer', () => {
    expect(
      shares(buildSplit({ method: 'equal', amountPaise: 1001, payerId: A, otherId: B })),
    ).toEqual({ [A]: 501, [B]: 500 });
    expect(shares(buildSplit({ method: 'equal', amountPaise: 1, payerId: B, otherId: A }))).toEqual(
      { [B]: 1, [A]: 0 },
    );
  });

  it('keeps a personal expense entirely with the payer', () => {
    const result = buildSplit({ method: 'personal', amountPaise: 4550, payerId: A, otherId: null });
    expect(shares(result)).toEqual({ [A]: 4550 });
    if (result.ok) expect(owedToPayer(result.shares, A)).toBe(0);
  });

  it('handles "payer covers all" and "paid for the other person"', () => {
    expect(
      shares(buildSplit({ method: 'payer_only', amountPaise: 999, payerId: A, otherId: B })),
    ).toEqual({ [A]: 999, [B]: 0 });
    expect(
      shares(buildSplit({ method: 'other_only', amountPaise: 999, payerId: A, otherId: B })),
    ).toEqual({ [A]: 0, [B]: 999 });
  });

  it('accepts exact amounts and derives the other share', () => {
    expect(
      shares(
        buildSplit({
          method: 'exact',
          amountPaise: 50000,
          payerId: A,
          otherId: B,
          payerSharePaise: 12345,
        }),
      ),
    ).toEqual({
      [A]: 12345,
      [B]: 37655,
    });
  });

  it('rejects an exact share larger than the amount or negative', () => {
    expect(
      buildSplit({
        method: 'exact',
        amountPaise: 100,
        payerId: A,
        otherId: B,
        payerSharePaise: 101,
      }),
    ).toEqual({
      ok: false,
      error: 'share_exceeds_amount',
    });
    expect(
      buildSplit({ method: 'exact', amountPaise: 100, payerId: A, otherId: B, payerSharePaise: -1 })
        .ok,
    ).toBe(false);
  });

  it('splits by uneven percentages with exact sums', () => {
    // 33.33% of ₹100: payer exact 3333 paise, other exact 6667 paise.
    const result = buildSplit({
      method: 'percent',
      amountPaise: 10000,
      payerId: A,
      otherId: B,
      payerBasisPoints: 3333,
    });
    expect(shares(result)).toEqual({ [A]: 3333, [B]: 6667 });
    // 33.33% of ₹1.01: payer 33.6633 -> 33, other 67.3367 -> 67, leftover 1 to larger remainder (other 0.3367 < payer 0.6633).
    expect(
      shares(
        buildSplit({
          method: 'percent',
          amountPaise: 101,
          payerId: A,
          otherId: B,
          payerBasisPoints: 3333,
        }),
      ),
    ).toEqual({
      [A]: 34,
      [B]: 67,
    });
  });

  it('preserves the total for many amounts and percentages', () => {
    for (const amount of [1, 2, 3, 7, 99, 101, 1001, 123457, MAX_AMOUNT_PAISE]) {
      for (const bp of [0, 1, 3333, 5000, 6667, 9999, 10000]) {
        expect(
          total(
            buildSplit({
              method: 'percent',
              amountPaise: amount,
              payerId: A,
              otherId: B,
              payerBasisPoints: bp,
            }),
          ),
        ).toBe(amount);
      }
      expect(
        total(buildSplit({ method: 'equal', amountPaise: amount, payerId: A, otherId: B })),
      ).toBe(amount);
    }
  });

  it('requires a partner for shared methods', () => {
    expect(buildSplit({ method: 'equal', amountPaise: 100, payerId: A, otherId: null })).toEqual({
      ok: false,
      error: 'partner_required',
    });
  });

  it('rejects invalid amounts', () => {
    for (const amount of [0, -100, 1.5, MAX_AMOUNT_PAISE + 1, Number.NaN]) {
      expect(buildSplit({ method: 'equal', amountPaise: amount, payerId: A, otherId: B })).toEqual({
        ok: false,
        error: 'invalid_amount',
      });
    }
  });

  it('rejects out-of-range percentages', () => {
    expect(
      buildSplit({
        method: 'percent',
        amountPaise: 100,
        payerId: A,
        otherId: B,
        payerBasisPoints: 10001,
      }).ok,
    ).toBe(false);
    expect(
      buildSplit({
        method: 'percent',
        amountPaise: 100,
        payerId: A,
        otherId: B,
        payerBasisPoints: 12.5,
      }).ok,
    ).toBe(false);
  });
});

describe('allocateByBasisPoints', () => {
  it('breaks exact ties in favour of the payer', () => {
    expect(allocateByBasisPoints(3, 5000)).toEqual([2, 1]);
  });
});

describe('parsePercentToBasisPoints', () => {
  it.each([
    ['50', 5000],
    ['33.33', 3333],
    ['0.5', 50],
    ['100', 10000],
    ['0', 0],
  ])('parses %s', (input, expected) => {
    expect(parsePercentToBasisPoints(input)).toBe(expected);
  });
  it.each(['101', '-1', '33.333', 'abc', ''])('rejects %s', (input) => {
    expect(parsePercentToBasisPoints(input)).toBeNull();
  });
});
