import { Download, Plus, IndianRupee } from 'lucide-react';
import { useMemo, useState } from 'react';
import { memberName, useHousehold } from '@/features/household';
import { monthRange, todayIn, type LocalDate } from '@/shared/lib/localDate';
import { useResource } from '@/shared/lib/useResource';
import { IconButton } from '@/shared/ui/Button';
import { Fab } from '@/shared/ui/Fab';
import { TextField } from '@/shared/ui/Field';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingRows } from '@/shared/ui/States';
import { BalanceCard } from '../components/BalanceCard';
import { ExpenseList } from '../components/ExpenseList';
import { ExpenseSheet } from '../components/ExpenseSheet';
import { MonthStepper } from '../components/MonthStepper';
import { SettlementList } from '../components/SettlementList';
import { SettleSheet } from '../components/SettleSheet';
import { SpendingSummaryCard } from '../components/SpendingSummaryCard';
import {
  EXPENSES_PAGE_LIMIT,
  listExpenses,
  listSettlements,
  loadBalances,
} from '../data/expensesApi';
import {
  filterExpenses,
  SHOW_ALL_EXPENSES,
  summarizeSpending,
  type ExpenseFilter,
} from '../domain/analytics';
import { summarizeBalance } from '../domain/balance';
import { expensesToCsv, settlementsToCsv } from '../domain/csv';
import type { Expense } from '../domain/types';

type SheetState =
  { kind: 'closed' } | { kind: 'expense'; expense: Expense | null } | { kind: 'settle' };

function downloadCsv(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function MoneyPage() {
  const household = useHousehold();
  const today = todayIn(household.timeZone, new Date());
  const [month, setMonth] = useState<LocalDate>(() => monthRange(today).start);
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' });
  const [filter, setFilter] = useState<ExpenseFilter>(SHOW_ALL_EXPENSES);
  const range = monthRange(month);

  const page = useResource(`money:${range.start}`, async (signal) => {
    const [expensePage, settlements] = await Promise.all([
      listExpenses(range, signal),
      listSettlements(range, signal),
    ]);
    return { ...expensePage, settlements };
  });
  const balances = useResource('money:balances', loadBalances);
  const summary = useMemo(
    () => (page.status === 'success' ? summarizeSpending(page.data.expenses) : null),
    [page],
  );

  const reloadAll = () => {
    page.reload();
    balances.reload();
  };
  const nameOf = (userId: string) => memberName(household, userId);
  const balanceSummary =
    balances.status === 'success'
      ? summarizeBalance(balances.data, household.me.userId)
      : { kind: 'settled' as const };

  return (
    <>
      <PageHeader
        title="Money"
        actions={
          page.status === 'success' &&
          page.data.expenses.length + page.data.settlements.length > 0 ? (
            <IconButton
              label="Export this month as CSV"
              onClick={() => {
                downloadCsv(
                  `expenses-${range.start.slice(0, 7)}.csv`,
                  expensesToCsv(page.data.expenses, nameOf),
                );
                if (page.data.settlements.length > 0) {
                  downloadCsv(
                    `settlements-${range.start.slice(0, 7)}.csv`,
                    settlementsToCsv(page.data.settlements, nameOf),
                  );
                }
              }}
            >
              <Download className="size-5" aria-hidden />
            </IconButton>
          ) : null
        }
      />
      <div className="flex flex-col gap-4">
        <BalanceCard
          balances={balances}
          onSettle={() => {
            setSheet({ kind: 'settle' });
          }}
        />
        <div className="flex justify-center">
          <MonthStepper month={month} today={today} onChange={setMonth} />
        </div>

        {page.status === 'loading' ? <LoadingRows rows={4} label="Loading expenses" /> : null}
        {page.status === 'error' ? <ErrorState error={page.error} onRetry={page.reload} /> : null}
        {page.status === 'success' && summary ? (
          page.data.expenses.length === 0 && page.data.settlements.length === 0 ? (
            <EmptyState
              icon={<IndianRupee className="size-8" aria-hidden />}
              title="No expenses this month"
              description={
                household.partner
                  ? 'Add what you spend. Shared costs are split exactly and kept in one balance.'
                  : 'Track what you spend. Invite your partner from Settings to split costs.'
              }
            />
          ) : (
            <>
              <SpendingSummaryCard summary={summary} />
              <SettlementList settlements={page.data.settlements} onChanged={reloadAll} />
              {page.data.expenses.length > 0 ? (
                <section aria-label="Expenses" className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {household.partner ? (
                      <SegmentedControl
                        label="Show"
                        className="sm:w-64"
                        options={[
                          { value: 'all', label: 'All' },
                          { value: 'shared', label: 'Shared' },
                          { value: 'personal', label: 'Personal' },
                        ]}
                        value={filter.scope}
                        onChange={(scope) => {
                          setFilter((f) => ({ ...f, scope }));
                        }}
                      />
                    ) : null}
                    <div className="flex-1">
                      <TextField
                        label="Search expenses"
                        hideLabel
                        type="search"
                        placeholder="Search"
                        value={filter.text}
                        onChange={(event) => {
                          setFilter((f) => ({ ...f, text: event.target.value }));
                        }}
                      />
                    </div>
                  </div>
                  <ExpenseList
                    expenses={filterExpenses(page.data.expenses, filter)}
                    today={today}
                    onOpen={(expense) => {
                      setSheet({ kind: 'expense', expense });
                    }}
                  />
                  {page.data.isTruncated ? (
                    <p className="text-center text-sm text-ink-muted">
                      Showing the latest {EXPENSES_PAGE_LIMIT} expenses of this month.
                    </p>
                  ) : null}
                </section>
              ) : null}
            </>
          )
        ) : null}
      </div>

      <Fab
        label="Add expense"
        icon={<Plus className="size-5" aria-hidden />}
        onClick={() => {
          setSheet({ kind: 'expense', expense: null });
        }}
      />
      <ExpenseSheet
        open={sheet.kind === 'expense'}
        expense={sheet.kind === 'expense' ? sheet.expense : null}
        today={today}
        onClose={() => {
          setSheet({ kind: 'closed' });
        }}
        onChanged={reloadAll}
      />
      <SettleSheet
        open={sheet.kind === 'settle'}
        balance={balanceSummary}
        today={today}
        onClose={() => {
          setSheet({ kind: 'closed' });
        }}
        onChanged={reloadAll}
      />
    </>
  );
}
