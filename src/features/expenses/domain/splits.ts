import { MAX_AMOUNT_PAISE } from '@/shared/lib/money';

/**
 * How an expense is divided between the two members. All arithmetic is in integer paise and every
 * method returns shares that sum exactly to the amount.
 *
 * Rounding rule (deterministic): when an amount cannot be divided exactly, the leftover paisa goes
 * to the share with the larger fractional remainder; on a tie it goes to the payer. For an equal
 * split of an odd amount that means the payer's share is one paisa larger, so the other person
 * never owes more than half.
 */
export type SplitMethod = 'personal' | 'equal' | 'exact' | 'percent' | 'payer_only' | 'other_only';

export const BASIS_POINTS_PER_WHOLE = 10_000; // 100% = 10,000 basis points (1% = 100)

export interface SplitShare {
  userId: string;
  sharePaise: number;
  /** Only set for the percent method. */
  percentBasisPoints: number | null;
}

export type SplitRequest =
  | {
      method: 'personal' | 'equal' | 'payer_only' | 'other_only';
      amountPaise: number;
      payerId: string;
      otherId: string | null;
    }
  | {
      method: 'exact';
      amountPaise: number;
      payerId: string;
      otherId: string | null;
      payerSharePaise: number;
    }
  | {
      method: 'percent';
      amountPaise: number;
      payerId: string;
      otherId: string | null;
      payerBasisPoints: number;
    };

export type SplitError =
  'invalid_amount' | 'partner_required' | 'share_exceeds_amount' | 'invalid_percent';

export type SplitResult = { ok: true; shares: SplitShare[] } | { ok: false; error: SplitError };

function isValidAmount(paise: number): boolean {
  return Number.isSafeInteger(paise) && paise >= 1 && paise <= MAX_AMOUNT_PAISE;
}

function twoWay(
  payerId: string,
  otherId: string,
  payerShare: number,
  otherShare: number,
  percent?: [number, number],
): SplitShare[] {
  return [
    { userId: payerId, sharePaise: payerShare, percentBasisPoints: percent ? percent[0] : null },
    { userId: otherId, sharePaise: otherShare, percentBasisPoints: percent ? percent[1] : null },
  ];
}

/** Splits `amount` by basis points between payer and other, using the documented rounding rule. */
export function allocateByBasisPoints(
  amountPaise: number,
  payerBasisPoints: number,
): [number, number] {
  const otherBasisPoints = BASIS_POINTS_PER_WHOLE - payerBasisPoints;
  const payerExact = amountPaise * payerBasisPoints;
  const otherExact = amountPaise * otherBasisPoints;
  let payerShare = Math.floor(payerExact / BASIS_POINTS_PER_WHOLE);
  let otherShare = Math.floor(otherExact / BASIS_POINTS_PER_WHOLE);
  const leftover = amountPaise - payerShare - otherShare;
  if (leftover > 0) {
    const payerRemainder = payerExact % BASIS_POINTS_PER_WHOLE;
    const otherRemainder = otherExact % BASIS_POINTS_PER_WHOLE;
    if (otherRemainder > payerRemainder) otherShare += leftover;
    else payerShare += leftover;
  }
  return [payerShare, otherShare];
}

export function buildSplit(request: SplitRequest): SplitResult {
  const { amountPaise, payerId, otherId } = request;
  if (!isValidAmount(amountPaise)) return { ok: false, error: 'invalid_amount' };

  if (request.method === 'personal') {
    return {
      ok: true,
      shares: [{ userId: payerId, sharePaise: amountPaise, percentBasisPoints: null }],
    };
  }
  if (otherId === null) return { ok: false, error: 'partner_required' };

  switch (request.method) {
    case 'equal': {
      const [payerShare, otherShare] = allocateByBasisPoints(
        amountPaise,
        BASIS_POINTS_PER_WHOLE / 2,
      );
      return { ok: true, shares: twoWay(payerId, otherId, payerShare, otherShare) };
    }
    case 'payer_only':
      return { ok: true, shares: twoWay(payerId, otherId, amountPaise, 0) };
    case 'other_only':
      return { ok: true, shares: twoWay(payerId, otherId, 0, amountPaise) };
    case 'exact': {
      const payerShare = request.payerSharePaise;
      if (!Number.isSafeInteger(payerShare) || payerShare < 0 || payerShare > amountPaise) {
        return { ok: false, error: 'share_exceeds_amount' };
      }
      return { ok: true, shares: twoWay(payerId, otherId, payerShare, amountPaise - payerShare) };
    }
    case 'percent': {
      const basisPoints = request.payerBasisPoints;
      if (
        !Number.isInteger(basisPoints) ||
        basisPoints < 0 ||
        basisPoints > BASIS_POINTS_PER_WHOLE
      ) {
        return { ok: false, error: 'invalid_percent' };
      }
      const [payerShare, otherShare] = allocateByBasisPoints(amountPaise, basisPoints);
      return {
        ok: true,
        shares: twoWay(payerId, otherId, payerShare, otherShare, [
          basisPoints,
          BASIS_POINTS_PER_WHOLE - basisPoints,
        ]),
      };
    }
  }
}

/**
 * How much the other person owes the payer because of this expense (their share), or zero for
 * personal expenses. Used for previews only; balances are computed by the database.
 */
export function owedToPayer(shares: readonly SplitShare[], payerId: string): number {
  return shares
    .filter((share) => share.userId !== payerId)
    .reduce((sum, share) => sum + share.sharePaise, 0);
}

/** Parses "33.5" (percent, up to 2 decimals) into basis points without floating-point error. */
export function parsePercentToBasisPoints(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const basisPoints = whole * 100 + fraction;
  return basisPoints <= BASIS_POINTS_PER_WHOLE ? basisPoints : null;
}
