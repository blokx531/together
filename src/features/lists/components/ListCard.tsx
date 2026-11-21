import { Lock } from 'lucide-react';
import { Link } from 'wouter';
import { LIST_KIND_PRESETS } from '../domain/listKinds';
import type { ListSummary } from '../domain/types';

export function listProgressText(list: ListSummary): string {
  if (!LIST_KIND_PRESETS[list.kind].isChecklist) {
    const total = list.openCount + list.doneCount;
    return `${total} ${total === 1 ? 'item' : 'items'}`;
  }
  if (list.openCount === 0 && list.doneCount === 0) return 'Empty';
  if (list.openCount === 0) return 'All done';
  return `${list.openCount} to go${list.doneCount > 0 ? ` · ${list.doneCount} done` : ''}`;
}

export function ListCard({ list }: { list: ListSummary }) {
  return (
    <Link
      href={`/lists/${list.id}`}
      className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card hover:bg-surface-2"
    >
      <span className="text-2xl" aria-hidden>
        {list.emoji || LIST_KIND_PRESETS[list.kind].emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{list.title}</span>
          {list.visibility === 'private' ? (
            <Lock className="size-3.5 shrink-0 text-ink-subtle" aria-label="Private" />
          ) : null}
        </span>
        <span className="block text-sm text-ink-muted">{listProgressText(list)}</span>
      </span>
    </Link>
  );
}
