import { formatLocalDate, parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { formatPaise } from '@/shared/lib/money';
import type { ItemDetails } from './itemDetails';

export interface ItemDescription {
  /** Short, human-readable metadata line, e.g. "5 kg · ₹250". Empty when there is nothing to show. */
  summary: string;
  isOverdue: boolean;
}

const quantityFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function describeItemDetails(
  details: ItemDetails,
  options: { today: LocalDate; isDone: boolean; nameOf: (userId: string) => string },
): ItemDescription {
  const parts: string[] = [];
  let isOverdue = false;
  switch (details.kind) {
    case 'grocery': {
      const { quantity, unit, pricePaise } = details.value;
      if (quantity !== undefined)
        parts.push(`${quantityFormat.format(quantity)}${unit ? ` ${unit}` : ''}`);
      if (pricePaise !== undefined) parts.push(`~${formatPaise(pricePaise)}`);
      break;
    }
    case 'todo': {
      const due = details.value.dueOn ? parseLocalDate(details.value.dueOn) : null;
      if (due) {
        isOverdue = !options.isDone && due < options.today;
        parts.push(
          due === options.today ? 'Due today' : `Due ${formatLocalDate(due, 'day-month')}`,
        );
      }
      if (details.value.assigneeId) parts.push(options.nameOf(details.value.assigneeId));
      break;
    }
    case 'watch': {
      if (details.value.rating !== undefined)
        parts.push(`${'★'.repeat(details.value.rating)}${'☆'.repeat(5 - details.value.rating)}`);
      if (details.value.link)
        parts.push(new URL(details.value.link).hostname.replace(/^www\./, ''));
      break;
    }
    case 'ideas': {
      if (details.value.link)
        parts.push(new URL(details.value.link).hostname.replace(/^www\./, ''));
      break;
    }
    case 'packing':
    case 'custom':
      break;
  }
  return { summary: parts.join(' · '), isOverdue };
}
