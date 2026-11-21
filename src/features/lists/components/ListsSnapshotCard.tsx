import { Link } from 'wouter';
import { useResource } from '@/shared/lib/useResource';
import { Card } from '@/shared/ui/Card';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { listLists } from '../data/listsApi';
import { listProgressText } from './ListCard';

const HOME_LIST_COUNT = 4;

/** Home-screen summary: the lists with the most open items. */
export function ListsSnapshotCard() {
  const lists = useResource('home-lists', listLists);
  return (
    <Card
      title="Lists"
      action={
        <Link href="/lists" className="text-sm font-medium text-accent">
          Open
        </Link>
      }
    >
      {lists.status === 'loading' ? <Skeleton className="h-16" /> : null}
      {lists.status === 'error' ? <ErrorState error={lists.error} onRetry={lists.reload} /> : null}
      {lists.status === 'success' ? (
        lists.data.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No lists yet. Groceries and to-dos are a good start.
          </p>
        ) : (
          <ul className="flex flex-col">
            {lists.data
              .filter((list) => !list.isArchived)
              .sort((a, b) => b.openCount - a.openCount)
              .slice(0, HOME_LIST_COUNT)
              .map((list) => (
                <li key={list.id}>
                  <Link
                    href={`/lists/${list.id}`}
                    className="flex min-h-11 items-center gap-3 rounded-control hover:bg-surface-2"
                  >
                    <span aria-hidden>{list.emoji}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{list.title}</span>
                    <span className="text-sm text-ink-muted">{listProgressText(list)}</span>
                  </Link>
                </li>
              ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}
