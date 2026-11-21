import { generateKeyBetween } from 'fractional-indexing';

/**
 * Item order uses fractional indexing: each item has a string key, and a moved item gets a new key
 * strictly between its new neighbours. No other item is rewritten. Keys compare byte-wise, which
 * is why the database column uses COLLATE "C" and JavaScript compares with `<`, not localeCompare.
 */
export function compareKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function keyAfter(lastKey: string | null): string {
  return generateKeyBetween(lastKey, null);
}

export function keyBefore(firstKey: string | null): string {
  return generateKeyBetween(null, firstKey);
}

interface Positioned {
  id: string;
  position: string;
}

/**
 * New key for moving `itemId` one step up or down within `ordered` (already sorted by key).
 * Returns null when the item is already at that edge.
 */
export function keyForMove(
  ordered: readonly Positioned[],
  itemId: string,
  direction: 'up' | 'down',
): string | null {
  const index = ordered.findIndex((item) => item.id === itemId);
  if (index === -1) return null;
  if (direction === 'up') {
    if (index === 0) return null;
    const before = ordered[index - 2]?.position ?? null;
    const after = ordered[index - 1]?.position ?? null;
    return generateKeyBetween(before, after);
  }
  if (index === ordered.length - 1) return null;
  const before = ordered[index + 1]?.position ?? null;
  const after = ordered[index + 2]?.position ?? null;
  return generateKeyBetween(before, after);
}
