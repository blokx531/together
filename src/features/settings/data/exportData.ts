import { AppError, toAppError } from '@/shared/lib/appError';
import { getSupabase, type AppSupabaseClient } from '@/shared/lib/supabase';
import type { Database, Tables } from '@/shared/types/database';

/**
 * Use a unique order for every table, including those with composite primary keys. Requests use
 * the caller's session so RLS limits every page to the records they can read.
 */
const EXPORT_ORDER = {
  profiles: ['user_id'],
  households: ['id'],
  household_members: ['household_id', 'user_id'],
  expenses: ['id'],
  expense_splits: ['expense_id', 'user_id'],
  settlements: ['id'],
  lists: ['id'],
  list_items: ['id'],
  foods: ['id'],
  food_servings: ['id'],
  meals: ['id'],
  meal_items: ['id'],
  nutrition_days: ['owner_user_id', 'local_date'],
  energy_profiles: ['user_id'],
  weight_goals: ['id'],
  weight_entries: ['id'],
  places: ['id'],
  visits: ['id'],
  visit_members: ['visit_id', 'user_id'],
} as const satisfies {
  [Table in keyof Database['public']['Tables']]?: readonly (keyof Tables<Table>)[];
};

type ExportedTable = keyof typeof EXPORT_ORDER;
const PAGE_SIZE = 500;

export interface DataExport {
  exportedAt: string;
  format: 'together-export';
  version: 1;
  tables: Record<ExportedTable, unknown[]>;
}

async function exportTable(db: AppSupabaseClient, table: ExportedTable): Promise<unknown[]> {
  const rows: unknown[] = [];
  let expectedCount: number | null = null;
  do {
    let query = db.from(table).select('*', { count: 'exact' });
    for (const column of EXPORT_ORDER[table]) query = query.order(column);
    if (table === 'foods') query = query.not('owner_user_id', 'is', null);
    const { data, error, count } = await query.range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw toAppError(error);
    if (
      count === null ||
      (expectedCount !== null && count !== expectedCount) ||
      (data.length === 0 && rows.length < count)
    ) {
      throw new AppError('conflict', 'Could not verify the complete export. Please try again.');
    }
    expectedCount = count;
    rows.push(...data);
  } while (rows.length < expectedCount);
  return rows;
}

export async function exportMyData(db: AppSupabaseClient = getSupabase()): Promise<DataExport> {
  const tables = {} as Record<ExportedTable, unknown[]>;
  for (const table of Object.keys(EXPORT_ORDER) as ExportedTable[]) {
    tables[table] = await exportTable(db, table);
  }
  return { exportedAt: new Date().toISOString(), format: 'together-export', version: 1, tables };
}
