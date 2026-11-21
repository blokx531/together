import { AppError, toAppError } from '@/shared/lib/appError';
import { getSupabase } from '@/shared/lib/supabase';
import type { Json, Tables } from '@/shared/types/database';
import { parseItemDetails, type ItemDetails } from '../domain/itemDetails';
import { isListKind, type ListKind } from '../domain/listKinds';
import { compareKeys } from '../domain/ordering';
import type { ListItem, ListSummary } from '../domain/types';

/** Upper bound for items fetched for one list; far above what a household list holds. */
const MAX_ITEMS_PER_LIST = 1000;
const MAX_SEARCH_RESULTS = 30;

function toKind(value: string): ListKind {
  if (!isListKind(value)) throw new Error(`Unexpected list kind: ${value}`);
  return value;
}

type ListRow = Pick<
  Tables<'lists'>,
  'id' | 'owner_user_id' | 'visibility' | 'kind' | 'title' | 'emoji' | 'description' | 'archived_at'
>;

function toSummary(row: ListRow, items: readonly { is_done: boolean }[]): ListSummary {
  const doneCount = items.filter((item) => item.is_done).length;
  return {
    id: row.id,
    ownerId: row.owner_user_id,
    visibility: row.visibility === 'private' ? 'private' : 'household',
    kind: toKind(row.kind),
    title: row.title,
    emoji: row.emoji,
    description: row.description,
    isArchived: row.archived_at !== null,
    openCount: items.length - doneCount,
    doneCount,
  };
}

function toItem(kind: ListKind, row: Tables<'list_items'>): ListItem {
  return {
    id: row.id,
    text: row.text,
    note: row.note,
    isDone: row.is_done,
    doneBy: row.done_by,
    position: row.position,
    details: parseItemDetails(kind, row.details),
    revision: row.revision,
  };
}

const LIST_COLUMNS = 'id, owner_user_id, visibility, kind, title, emoji, description, archived_at';

export async function listLists(signal: AbortSignal): Promise<ListSummary[]> {
  const { data, error } = await getSupabase()
    .from('lists')
    .select(`${LIST_COLUMNS}, list_items(is_done)`)
    .order('created_at', { ascending: true })
    .abortSignal(signal);
  if (error) throw toAppError(error);
  return data.map((row) => toSummary(row, row.list_items));
}

export interface ListDetail {
  list: ListSummary;
  items: ListItem[];
}

export async function loadList(listId: string, signal: AbortSignal): Promise<ListDetail> {
  const { data, error } = await getSupabase()
    .from('lists')
    .select(`${LIST_COLUMNS}, list_items(*)`)
    .eq('id', listId)
    .limit(MAX_ITEMS_PER_LIST, { referencedTable: 'list_items' })
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new AppError('not_found', 'This list does not exist or is private.');
  const kind = toKind(data.kind);
  const items = data.list_items
    .map((row) => toItem(kind, row))
    .sort((a, b) => compareKeys(a.position, b.position));
  return { list: toSummary(data, data.list_items), items };
}

export interface NewList {
  requestId: string;
  householdId: string;
  ownerId: string;
  kind: ListKind;
  title: string;
  emoji: string;
  visibility: 'private' | 'household';
}

export async function createList(input: NewList): Promise<string> {
  const db = getSupabase();
  const { error } = await db.from('lists').upsert(
    {
      client_request_id: input.requestId,
      household_id: input.householdId,
      owner_user_id: input.ownerId,
      kind: input.kind,
      title: input.title,
      emoji: input.emoji,
      visibility: input.visibility,
    },
    { onConflict: 'client_request_id', ignoreDuplicates: true },
  );
  if (error) throw toAppError(error);
  const created = await db
    .from('lists')
    .select('id')
    .eq('client_request_id', input.requestId)
    .single();
  if (created.error) throw toAppError(created.error);
  return created.data.id;
}

export interface ListUpdate {
  title?: string;
  emoji?: string;
  visibility?: 'private' | 'household';
  archived?: boolean;
}

export async function updateList(listId: string, update: ListUpdate): Promise<void> {
  const { archived, ...rest } = update;
  const { error } = await getSupabase()
    .from('lists')
    .update({
      ...rest,
      ...(archived === undefined
        ? {}
        : { archived_at: archived ? new Date().toISOString() : null }),
    })
    .eq('id', listId);
  if (error) throw toAppError(error);
}

export async function deleteList(listId: string): Promise<void> {
  const { data, error } = await getSupabase().from('lists').delete().eq('id', listId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0)
    throw new AppError('forbidden', 'Only the person who created this list can delete it.');
}

function detailsToJson(details: ItemDetails): Record<string, Json | undefined> {
  return { ...details.value };
}

export interface NewItem {
  requestId: string;
  listId: string;
  text: string;
  details: ItemDetails;
  position: string;
}

export async function addItem(input: NewItem): Promise<void> {
  const { error } = await getSupabase()
    .from('list_items')
    .upsert(
      {
        client_request_id: input.requestId,
        list_id: input.listId,
        text: input.text,
        details: detailsToJson(input.details),
        position: input.position,
      },
      { onConflict: 'client_request_id', ignoreDuplicates: true },
    );
  if (error) throw toAppError(error);
}

export interface ItemContent {
  text: string;
  note: string | null;
  details: ItemDetails;
}

/**
 * Saves edited text/note/details only if nobody changed the item since it was loaded.
 * Throws a `conflict` AppError (code STALE_ITEM) otherwise, so the UI can refetch and explain.
 */
export async function updateItemContent(
  item: Pick<ListItem, 'id' | 'revision'>,
  content: ItemContent,
): Promise<void> {
  const { data, error } = await getSupabase()
    .from('list_items')
    .update({ text: content.text, note: content.note, details: detailsToJson(content.details) })
    .eq('id', item.id)
    .eq('revision', item.revision)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0)
    throw new AppError('conflict', 'This item was changed or removed meanwhile.', 'STALE_ITEM');
}

/** Ticking is an absolute intent ("done" / "not done"), so it applies regardless of revision. */
export async function setItemDone(itemId: string, isDone: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('list_items')
    .update({ is_done: isDone })
    .eq('id', itemId);
  if (error) throw toAppError(error);
}

export async function moveItem(itemId: string, position: string): Promise<void> {
  const { error } = await getSupabase().from('list_items').update({ position }).eq('id', itemId);
  if (error) throw toAppError(error);
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await getSupabase().from('list_items').delete().eq('id', itemId);
  if (error) throw toAppError(error);
}

export async function clearDoneItems(listId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('is_done', true);
  if (error) throw toAppError(error);
}

export interface SearchHit {
  listId: string;
  listTitle: string;
  listEmoji: string;
  itemId: string;
  text: string;
  isDone: boolean;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Finds items by text across all lists the caller may see (RLS limits the scope). */
export async function searchItems(query: string, signal: AbortSignal): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { data, error } = await getSupabase()
    .from('list_items')
    .select('id, text, is_done, lists!inner(id, title, emoji)')
    .ilike('text', `%${escapeLikePattern(trimmed)}%`)
    .order('is_done', { ascending: true })
    .limit(MAX_SEARCH_RESULTS)
    .abortSignal(signal);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    listId: row.lists.id,
    listTitle: row.lists.title,
    listEmoji: row.lists.emoji,
    itemId: row.id,
    text: row.text,
    isDone: row.is_done,
  }));
}
