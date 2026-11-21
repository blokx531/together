/** List presets. Mirrors the CHECK constraint on public.lists.kind. */
export const LIST_KINDS = ['todo', 'grocery', 'watch', 'ideas', 'packing', 'custom'] as const;
export type ListKind = (typeof LIST_KINDS)[number];

interface ListKindPreset {
  label: string;
  emoji: string;
  /** Short line used when creating a list. */
  hint: string;
  /** Whether items are ticked off. Ideas are a collection, not a checklist. */
  isChecklist: boolean;
  /** Placeholder for the quick-add field. */
  addPlaceholder: string;
}

export const LIST_KIND_PRESETS: Record<ListKind, ListKindPreset> = {
  todo: {
    label: 'To-do',
    emoji: '✅',
    hint: 'Tasks with due dates and who is on it',
    isChecklist: true,
    addPlaceholder: 'Add a task',
  },
  grocery: {
    label: 'Groceries',
    emoji: '🛒',
    hint: 'Quantities, units and rough prices',
    isChecklist: true,
    addPlaceholder: 'Add an item, e.g. Atta 5 kg',
  },
  watch: {
    label: 'Watchlist',
    emoji: '🎬',
    hint: 'Movies and series, with ratings',
    isChecklist: true,
    addPlaceholder: 'Add a movie or series',
  },
  ideas: {
    label: 'Ideas',
    emoji: '💡',
    hint: 'Notes and links worth keeping',
    isChecklist: false,
    addPlaceholder: 'Add an idea',
  },
  packing: {
    label: 'Packing',
    emoji: '🧳',
    hint: 'A checklist for trips',
    isChecklist: true,
    addPlaceholder: 'Add something to pack',
  },
  custom: {
    label: 'Custom',
    emoji: '📝',
    hint: 'A simple checklist',
    isChecklist: true,
    addPlaceholder: 'Add an item',
  },
};

export function isListKind(value: string): value is ListKind {
  return (LIST_KINDS as readonly string[]).includes(value);
}
