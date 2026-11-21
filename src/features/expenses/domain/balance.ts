import type { MemberBalance } from './types';

export type BalanceSummary =
  | { kind: 'settled' }
  | { kind: 'you-are-owed'; amountPaise: number; debtorId: string }
  | { kind: 'you-owe'; amountPaise: number; creditorId: string };

/**
 * Turns the database's per-member net positions into "who owes whom" from the viewer's side.
 * With two members the nets are equal and opposite, so the viewer's own net is the whole story.
 */
export function summarizeBalance(
  balances: readonly MemberBalance[],
  viewerId: string,
): BalanceSummary {
  const mine = balances.find((b) => b.userId === viewerId);
  const other = balances.find((b) => b.userId !== viewerId);
  if (!mine || !other || mine.netPaise === 0) return { kind: 'settled' };
  if (mine.netPaise > 0)
    return { kind: 'you-are-owed', amountPaise: mine.netPaise, debtorId: other.userId };
  return { kind: 'you-owe', amountPaise: -mine.netPaise, creditorId: other.userId };
}
