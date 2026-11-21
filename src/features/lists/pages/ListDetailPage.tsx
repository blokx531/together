import { ArrowDown, ArrowUp, ChevronLeft, Lock, Plus, Settings2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { Link } from 'wouter';
import { memberName, useHousehold } from '@/features/household';
import { todayIn } from '@/shared/lib/localDate';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useResource } from '@/shared/lib/useResource';
import { Button, IconButton } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { EmptyState, ErrorState, LoadingRows } from '@/shared/ui/States';
import { useToast } from '@/shared/ui/Toast';
import { ItemSheet } from '../components/ItemSheet';
import { ListSettingsSheet } from '../components/ListSettingsSheet';
import { addItem, clearDoneItems, loadList, moveItem, setItemDone } from '../data/listsApi';
import { describeItemDetails } from '../domain/describeItem';
import { parseGroceryQuickAdd, type ItemDetails } from '../domain/itemDetails';
import { LIST_KIND_PRESETS, type ListKind } from '../domain/listKinds';
import { keyAfter, keyForMove } from '../domain/ordering';
import type { ListItem } from '../domain/types';

function quickAddDetails(kind: ListKind, input: string): { text: string; details: ItemDetails } {
  if (kind === 'grocery') {
    const parsed = parseGroceryQuickAdd(input);
    return { text: parsed.text, details: { kind, value: parsed.details } };
  }
  return { text: input.trim(), details: parseEmpty(kind) };
}

function parseEmpty(kind: ListKind): ItemDetails {
  switch (kind) {
    case 'grocery':
    case 'todo':
    case 'watch':
    case 'ideas':
      return { kind, value: {} };
    case 'packing':
    case 'custom':
      return { kind, value: {} };
  }
}

interface QuickAddProps {
  listId: string;
  kind: ListKind;
  lastPosition: string | null;
  onAdded: () => void;
}

function QuickAdd({ listId, kind, lastPosition, onAdded }: QuickAddProps) {
  const [text, setText] = useState('');
  const [requestId, setRequestId] = useState(newRequestId);
  const add = useAsyncAction(addItem);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === '') return;
    const parsed = quickAddDetails(kind, text);
    const result = await add.run({
      requestId,
      listId,
      text: parsed.text,
      details: parsed.details,
      position: keyAfter(lastPosition),
    });
    if (result?.ok) {
      setText('');
      setRequestId(newRequestId());
      onAdded();
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="New item"
            hideLabel
            maxLength={200}
            placeholder={LIST_KIND_PRESETS[kind].addPlaceholder}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </div>
        <Button
          type="submit"
          isLoading={add.isPending}
          icon={<Plus className="size-4" aria-hidden />}
        >
          Add
        </Button>
      </div>
      <FormError message={add.error?.message} />
    </form>
  );
}

export function ListDetailPage({ params }: { params: { id: string } }) {
  const household = useHousehold();
  const toast = useToast();
  const today = todayIn(household.timeZone, new Date());
  const detail = useResource(`list:${params.id}`, (signal) => loadList(params.id, signal));
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Optimistic tick state, cleared once the server confirms (or reverted on failure).
  const [pendingDone, setPendingDone] = useState<ReadonlyMap<string, boolean>>(new Map());

  if (detail.status === 'loading') return <LoadingRows rows={5} label="Loading list" />;
  if (detail.status === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/lists" className="text-sm font-medium text-accent">
          ← All lists
        </Link>
        <ErrorState
          error={detail.error}
          onRetry={detail.error.kind === 'not_found' ? undefined : detail.reload}
        />
      </div>
    );
  }

  const { list, items } = detail.data;
  const preset = LIST_KIND_PRESETS[list.kind];
  const isDoneNow = (item: ListItem) => pendingDone.get(item.id) ?? item.isDone;
  const openItems = preset.isChecklist ? items.filter((item) => !isDoneNow(item)) : items;
  const doneItems = preset.isChecklist ? items.filter(isDoneNow) : [];
  const nameOf = (userId: string) => memberName(household, userId);

  const toggle = (item: ListItem) => {
    const next = !isDoneNow(item);
    setPendingDone((current) => new Map(current).set(item.id, next));
    setItemDone(item.id, next)
      .then(() => {
        detail.reload();
      })
      .catch(() => {
        toast.show('Could not update the item. Check your connection.', { tone: 'error' });
      })
      .finally(() => {
        setPendingDone((current) => {
          const copy = new Map(current);
          copy.delete(item.id);
          return copy;
        });
      });
  };

  const move = (item: ListItem, direction: 'up' | 'down') => {
    const position = keyForMove(openItems, item.id, direction);
    if (position === null) return;
    moveItem(item.id, position).then(detail.reload, () => {
      toast.show('Could not move the item.', { tone: 'error' });
    });
  };

  const clearDone = () => {
    clearDoneItems(list.id).then(detail.reload, () => {
      toast.show('Could not clear done items.', { tone: 'error' });
    });
  };

  const renderItem = (item: ListItem, index: number, group: readonly ListItem[]) => {
    const description = describeItemDetails(item.details, {
      today,
      isDone: isDoneNow(item),
      nameOf,
    });
    const done = isDoneNow(item);
    return (
      <li
        key={item.id}
        className="flex min-h-14 items-center gap-1 border-b border-line px-2 last:border-b-0"
      >
        {preset.isChecklist ? (
          <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              className="size-5 accent-accent"
              checked={done}
              onChange={() => {
                toggle(item);
              }}
              aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${item.text}`}
            />
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setEditing(item);
          }}
          className={`min-w-0 flex-1 py-2 text-left ${preset.isChecklist ? '' : 'pl-2'}`}
        >
          <span className={`block break-words ${done ? 'text-ink-subtle line-through' : ''}`}>
            {item.text}
          </span>
          {description.summary || item.note ? (
            <span
              className={`block truncate text-sm ${description.isOverdue ? 'text-negative' : 'text-ink-muted'}`}
            >
              {[description.summary, item.note].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </button>
        {isReordering && !done ? (
          <>
            <IconButton
              label={`Move up: ${item.text}`}
              disabled={index === 0}
              onClick={() => {
                move(item, 'up');
              }}
            >
              <ArrowUp className="size-4" aria-hidden />
            </IconButton>
            <IconButton
              label={`Move down: ${item.text}`}
              disabled={index === group.length - 1}
              onClick={() => {
                move(item, 'down');
              }}
            >
              <ArrowDown className="size-4" aria-hidden />
            </IconButton>
          </>
        ) : null}
      </li>
    );
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <Link
          href="/lists"
          aria-label="All lists"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-2xl font-semibold tracking-tight">
          <span aria-hidden>{list.emoji || preset.emoji}</span>
          <span className="truncate">{list.title}</span>
          {list.visibility === 'private' ? (
            <Lock className="size-4 shrink-0 text-ink-subtle" aria-label="Private" />
          ) : null}
        </h1>
        {openItems.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={isReordering}
            onClick={() => {
              setIsReordering((value) => !value);
            }}
          >
            {isReordering ? 'Done' : 'Reorder'}
          </Button>
        ) : null}
        <IconButton
          label="List settings"
          onClick={() => {
            setIsSettingsOpen(true);
          }}
        >
          <Settings2 className="size-5" aria-hidden />
        </IconButton>
      </div>
      {list.isArchived ? (
        <p className="mb-4 rounded-control bg-warning-soft px-3 py-2 text-sm">
          This list is archived.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <QuickAdd
          listId={list.id}
          kind={list.kind}
          lastPosition={items.at(-1)?.position ?? null}
          onAdded={detail.reload}
        />
        {items.length === 0 ? (
          <EmptyState title="Nothing here yet" description={preset.hint} />
        ) : (
          <>
            {openItems.length > 0 ? (
              <ul
                aria-label="Items"
                className="overflow-hidden rounded-card border border-line bg-surface"
              >
                {openItems.map((item, index) => renderItem(item, index, openItems))}
              </ul>
            ) : (
              <p className="text-center text-sm text-ink-muted">Everything is done.</p>
            )}
            {doneItems.length > 0 ? (
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between px-1 text-sm font-medium text-ink-muted">
                  Done ({doneItems.length})
                </summary>
                <ul
                  aria-label="Done items"
                  className="mt-1 overflow-hidden rounded-card border border-line bg-surface"
                >
                  {doneItems.map((item, index) => renderItem(item, index, doneItems))}
                </ul>
                <Button variant="ghost" size="sm" className="mt-2" onClick={clearDone}>
                  Clear done items
                </Button>
              </details>
            ) : null}
          </>
        )}
      </div>

      <ItemSheet
        item={editing}
        kind={list.kind}
        onClose={() => {
          setEditing(null);
        }}
        onChanged={detail.reload}
      />
      <ListSettingsSheet
        list={list}
        open={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
        }}
        onChanged={detail.reload}
      />
    </>
  );
}
