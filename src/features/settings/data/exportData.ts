import { toAppError } from '@/shared/lib/appError';
import { getSupabase } from '@/shared/lib/supabase';

/**
 * Personal data export (JSON). The free Supabase plan has no backups, so this is the user's copy.
 * Each query runs with the user's own session, so RLS limits the export to exactly what they can see:
 * their own records plus whatever the partner shares. Secrets (invite token hashes) are not readable.
 */
const EXPORTED_TABLES = [
  'profiles',
  'households',
  'household_members',
  'expenses',
  'expense_splits',
  'settlements',
  'lists',
  'list_items',
  'foods',
  'food_servings',
  'meals',
  'meal_items',
  'nutrition_days',
  'energy_profiles',
  'weight_goals',
  'weight_entries',
  'places',
  'visits',
  'visit_members',
] as const;

type ExportedTable = (typeof EXPORTED_TABLES)[number];

/** Catalog foods are public reference data; only the user's own/shared custom foods are exported. */
const ROW_LIMIT = 10_000;

export interface DataExport {
  exportedAt: string;
  format: 'together-export';
  version: 1;
  tables: Record<ExportedTable, unknown[]>;
}

export async function exportMyData(): Promise<DataExport> {
  const db = getSupabase();
  const tables = {} as Record<ExportedTable, unknown[]>;
  for (const table of EXPORTED_TABLES) {
    let query = db.from(table).select('*').limit(ROW_LIMIT);
    if (table === 'foods') query = query.not('owner_user_id', 'is', null);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    tables[table] = data;
  }
  return { exportedAt: new Date().toISOString(), format: 'together-export', version: 1, tables };
}
