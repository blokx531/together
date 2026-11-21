import { ListChecks, Plus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Link } from 'wouter';
import { useHousehold } from '@/features/household';
import { useResource } from '@/shared/lib/useResource';
import { Fab } from '@/shared/ui/Fab';
import { TextField } from '@/shared/ui/Field';
import { PageHeader } from '@/shared/ui/PageHeader';
import { EmptyState, ErrorState, LoadingRows } from '@/shared/ui/States';
import { ListCard } from '../components/ListCard';
import { NewListSheet } from '../components/NewListSheet';
import { listLists, searchItems } from '../data/listsApi';
import type { ListSummary } from '../domain/types';

function Section({ title, lists }: { title: string; lists: readonly ListSummary[] }) {
  if (lists.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        {title}
      </h2>
      {lists.map((list) => (
        <ListCard key={list.id} list={list} />
      ))}
    </section>
  );
}

function SearchResults({ query }: { query: string }) {
  const results = useResource(`list-search:${query}`, (signal) => searchItems(query, signal));
  if (results.status === 'loading') return <LoadingRows rows={2} label="Searching" />;
  if (results.status === 'error')
    return <ErrorState error={results.error} onRetry={results.reload} />;
  if (results.data.length === 0)
    return <p className="text-center text-sm text-ink-muted">No items match “{query}”.</p>;
  return (
    <ul
      aria-label="Search results"
      className="overflow-hidden rounded-card border border-line bg-surface"
    >
      {results.data.map((hit) => (
        <li key={hit.itemId} className="border-b border-line last:border-b-0">
          <Link
            href={`/lists/${hit.listId}`}
            className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-2"
          >
            <span aria-hidden>{hit.listEmoji}</span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate ${hit.isDone ? 'text-ink-subtle line-through' : ''}`}
              >
                {hit.text}
              </span>
              <span className="block truncate text-xs text-ink-muted">{hit.listTitle}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ListsPage() {
  const household = useHousehold();
  const lists = useResource('lists', listLists);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const [showArchived, setShowArchived] = useState(false);

  return (
    <>
      <PageHeader title="Lists" />
      <div className="flex flex-col gap-5">
        <TextField
          label="Search all lists"
          hideLabel
          type="search"
          placeholder="Search items in all lists"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        {deferredQuery.length >= 2 ? (
          <SearchResults query={deferredQuery} />
        ) : lists.status === 'loading' ? (
          <LoadingRows rows={3} label="Loading lists" />
        ) : lists.status === 'error' ? (
          <ErrorState error={lists.error} onRetry={lists.reload} />
        ) : lists.data.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-8" aria-hidden />}
            title="No lists yet"
            description="Groceries, to-dos, movies to watch, ideas — shared or just for you."
          />
        ) : (
          (() => {
            const active = lists.data.filter((list) => !list.isArchived);
            const archived = lists.data.filter((list) => list.isArchived);
            return (
              <>
                {household.partner ? (
                  <>
                    <Section
                      title="Shared"
                      lists={active.filter((list) => list.visibility === 'household')}
                    />
                    <Section
                      title="Just you"
                      lists={active.filter((list) => list.visibility === 'private')}
                    />
                  </>
                ) : (
                  <Section title="Your lists" lists={active} />
                )}
                {archived.length > 0 ? (
                  <div>
                    <button
                      type="button"
                      className="min-h-11 px-1 text-sm font-medium text-accent"
                      aria-expanded={showArchived}
                      onClick={() => {
                        setShowArchived((value) => !value);
                      }}
                    >
                      {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
                    </button>
                    {showArchived ? <Section title="Archived" lists={archived} /> : null}
                  </div>
                ) : null}
              </>
            );
          })()
        )}
      </div>
      <Fab
        label="New list"
        icon={<Plus className="size-5" aria-hidden />}
        onClick={() => {
          setIsCreating(true);
        }}
      />
      <NewListSheet
        open={isCreating}
        onClose={() => {
          setIsCreating(false);
        }}
      />
    </>
  );
}
