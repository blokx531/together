import type { LocalDate } from '@/shared/lib/localDate';
import type { ExpenseCategory } from './categories';
import type { SplitMethod, SplitShare } from './splits';

export type ExpenseScope = 'personal' | 'shared';
export type ExpenseVisibility = 'private' | 'household';

export interface Expense {
  id: string;
  createdBy: string;
  payerId: string;
  scope: ExpenseScope;
  visibility: ExpenseVisibility;
  splitMethod: SplitMethod;
  amountPaise: number;
  category: ExpenseCategory;
  title: string;
  note: string | null;
  spentOn: LocalDate;
  version: number;
  shares: SplitShare[];
}

export interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountPaise: number;
  settledOn: LocalDate;
  note: string | null;
}

export interface MemberBalance {
  userId: string;
  paidPaise: number;
  sharePaise: number;
  settlementsPaidPaise: number;
  settlementsReceivedPaise: number;
  /** Positive: is owed money. Negative: owes money. */
  netPaise: number;
}
