import { toAppError } from '@/shared/lib/appError';
import { parseLocalDate, type DateRange, type LocalDate } from '@/shared/lib/localDate';
import { getSupabase } from '@/shared/lib/supabase';
import type { Json, Tables } from '@/shared/types/database';
import { isExpenseCategory, type ExpenseCategory } from '../domain/categories';
import type { SplitMethod, SplitShare } from '../domain/splits';
import type {
  Expense,
  ExpenseScope,
  ExpenseVisibility,
  MemberBalance,
  Settlement,
} from '../domain/types';

/** Two people rarely log more than this in a month; the UI says so if the cap is reached. */
export const EXPENSES_PAGE_LIMIT = 500;

const SPLIT_METHODS: readonly SplitMethod[] = [
  'personal',
  'equal',
  'exact',
  'percent',
  'payer_only',
  'other_only',
];

function requireLocalDate(value: string): LocalDate {
  const date = parseLocalDate(value);
  if (!date) throw new Error(`Unexpected date from database: ${value}`);
  return date;
}

function toSplitMethod(value: string): SplitMethod {
  const method = SPLIT_METHODS.find((m) => m === value);
  if (!method) throw new Error(`Unexpected split method: ${value}`);
  return method;
}

function toCategory(value: string): ExpenseCategory {
  if (!isExpenseCategory(value)) throw new Error(`Unexpected category: ${value}`);
  return value;
}

type ExpenseRow = Tables<'expenses'> & { expense_splits: Tables<'expense_splits'>[] };

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    createdBy: row.created_by,
    payerId: row.payer_user_id,
    scope: row.scope === 'personal' ? 'personal' : 'shared',
    visibility: row.visibility === 'private' ? 'private' : 'household',
    splitMethod: toSplitMethod(row.split_method),
    amountPaise: row.amount_paise,
    category: toCategory(row.category),
    title: row.title,
    note: row.note,
    spentOn: requireLocalDate(row.spent_on),
    version: row.version,
    shares: row.expense_splits.map((split) => ({
      userId: split.user_id,
      sharePaise: split.share_paise,
      percentBasisPoints: split.percent_basis_points,
    })),
  };
}

export interface ExpensePage {
  expenses: Expense[];
  isTruncated: boolean;
}

export async function listExpenses(range: DateRange, signal: AbortSignal): Promise<ExpensePage> {
  const { data, error } = await getSupabase()
    .from('expenses')
    .select('*, expense_splits(*)')
    .is('voided_at', null)
    .gte('spent_on', range.start)
    .lt('spent_on', range.end)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(EXPENSES_PAGE_LIMIT)
    .abortSignal(signal);
  if (error) throw toAppError(error);
  return { expenses: data.map(toExpense), isTruncated: data.length === EXPENSES_PAGE_LIMIT };
}

export async function listSettlements(
  range: DateRange,
  signal: AbortSignal,
): Promise<Settlement[]> {
  const { data, error } = await getSupabase()
    .from('settlements')
    .select('id, from_user_id, to_user_id, amount_paise, settled_on, note')
    .is('voided_at', null)
    .gte('settled_on', range.start)
    .lt('settled_on', range.end)
    .order('settled_on', { ascending: false })
    .limit(EXPENSES_PAGE_LIMIT)
    .abortSignal(signal);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amountPaise: row.amount_paise,
    settledOn: requireLocalDate(row.settled_on),
    note: row.note,
  }));
}

export async function loadBalances(signal: AbortSignal): Promise<MemberBalance[]> {
  const { data, error } = await getSupabase().rpc('household_balances').abortSignal(signal);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    userId: row.user_id,
    paidPaise: row.paid_paise,
    sharePaise: row.share_paise,
    settlementsPaidPaise: row.settlements_paid_paise,
    settlementsReceivedPaise: row.settlements_received_paise,
    netPaise: row.net_paise,
  }));
}

export interface SaveExpenseInput {
  requestId: string;
  /** Null when creating. */
  existing: { id: string; version: number } | null;
  payerId: string;
  scope: ExpenseScope;
  visibility: ExpenseVisibility;
  splitMethod: SplitMethod;
  amountPaise: number;
  category: ExpenseCategory;
  title: string;
  note: string;
  spentOn: LocalDate;
  shares: readonly SplitShare[];
}

export async function saveExpense(input: SaveExpenseInput): Promise<string> {
  const splits: Json = input.shares.map((share) => ({
    user_id: share.userId,
    share_paise: share.sharePaise,
    percent_basis_points: share.percentBasisPoints,
  }));
  const { data, error } = await getSupabase().rpc('save_expense', {
    p_client_request_id: input.requestId,
    p_payer_user_id: input.payerId,
    p_scope: input.scope,
    p_visibility: input.visibility,
    p_split_method: input.splitMethod,
    p_amount_paise: input.amountPaise,
    p_category: input.category,
    p_title: input.title,
    p_note: input.note,
    p_spent_on: input.spentOn,
    p_splits: splits,
    ...(input.existing
      ? { p_expense_id: input.existing.id, p_expected_version: input.existing.version }
      : {}),
  });
  if (error) throw toAppError(error);
  return data;
}

export async function setExpenseVoided(
  expenseId: string,
  expectedVersion: number,
  voided: boolean,
): Promise<void> {
  const { error } = await getSupabase().rpc('set_expense_voided', {
    p_expense_id: expenseId,
    p_expected_version: expectedVersion,
    p_voided: voided,
  });
  if (error) throw toAppError(error);
}

export interface RecordSettlementInput {
  requestId: string;
  fromUserId: string;
  toUserId: string;
  amountPaise: number;
  settledOn: LocalDate;
  note: string;
}

export async function recordSettlement(input: RecordSettlementInput): Promise<string> {
  const { data, error } = await getSupabase().rpc('record_settlement', {
    p_client_request_id: input.requestId,
    p_from_user_id: input.fromUserId,
    p_to_user_id: input.toUserId,
    p_amount_paise: input.amountPaise,
    p_settled_on: input.settledOn,
    p_note: input.note,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function setSettlementVoided(settlementId: string, voided: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('set_settlement_voided', {
    p_settlement_id: settlementId,
    p_voided: voided,
  });
  if (error) throw toAppError(error);
}
