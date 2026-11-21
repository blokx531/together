import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/lib/localDate';
import { describeItemDetails } from './describeItem';
import {
  detailsFromFields,
  EMPTY_DETAIL_FIELDS,
  fieldsFromDetails,
  isValidLink,
  parseGroceryQuickAdd,
  parseItemDetails,
} from './itemDetails';
import { compareKeys, keyAfter, keyBefore, keyForMove } from './ordering';

describe('ordering', () => {
  it('appends and prepends keys in byte order', () => {
    const first = keyAfter(null);
    const second = keyAfter(first);
    const zeroth = keyBefore(first);
    expect([second, first, zeroth].sort(compareKeys)).toEqual([zeroth, first, second]);
  });

  it('moves an item between its new neighbours without touching others', () => {
    const a = keyAfter(null);
    const b = keyAfter(a);
    const c = keyAfter(b);
    const items = [
      { id: 'a', position: a },
      { id: 'b', position: b },
      { id: 'c', position: c },
    ];
    const upKey = keyForMove(items, 'c', 'up');
    expect(upKey !== null && upKey > a && upKey < b).toBe(true);
    const downKey = keyForMove(items, 'a', 'down');
    expect(downKey !== null && downKey > b && downKey < c).toBe(true);
    expect(keyForMove(items, 'a', 'up')).toBeNull();
    expect(keyForMove(items, 'c', 'down')).toBeNull();
  });

  it('survives many moves to the same spot', () => {
    let low = keyAfter(null);
    const high = keyAfter(low);
    for (let i = 0; i < 200; i += 1) {
      const items = [
        { id: 'low', position: low },
        { id: 'x', position: high },
      ];
      const next = keyForMove(items, 'x', 'up');
      expect(next).not.toBeNull();
      low = next ?? low;
    }
    expect(compareKeys(low, high)).toBe(-1);
  });
});

describe('item details', () => {
  it('keeps valid grocery details and drops malformed ones', () => {
    expect(parseItemDetails('grocery', { quantity: 2, unit: 'kg' })).toEqual({
      kind: 'grocery',
      value: { quantity: 2, unit: 'kg' },
    });
    expect(parseItemDetails('grocery', { quantity: -1 })).toEqual({ kind: 'grocery', value: {} });
    expect(parseItemDetails('grocery', { injected: true })).toEqual({ kind: 'grocery', value: {} });
  });

  it('validates to-do due dates and assignees', () => {
    expect(parseItemDetails('todo', { dueOn: '2026-12-01' }).value).toEqual({
      dueOn: '2026-12-01',
    });
    expect(parseItemDetails('todo', { dueOn: '2026-02-30' }).value).toEqual({});
  });

  it('only accepts http(s) links', () => {
    expect(isValidLink('https://www.imdb.com/title/tt0000001/')).toBe(true);
    expect(isValidLink('javascript:alert(1)')).toBe(false);
    expect(parseItemDetails('watch', { link: 'javascript:alert(1)', rating: 4 }).value).toEqual({});
  });
});

describe('parseGroceryQuickAdd', () => {
  it.each([
    ['Atta 5 kg', { text: 'Atta', details: { quantity: 5, unit: 'kg' } }],
    ['Eggs 12', { text: 'Eggs', details: { quantity: 12 } }],
    ['Milk 1.5 L', { text: 'Milk', details: { quantity: 1.5, unit: 'l' } }],
    ['Coriander', { text: 'Coriander', details: {} }],
    ['7up', { text: '7up', details: {} }],
  ])('parses %s', (input, expected) => {
    expect(parseGroceryQuickAdd(input)).toEqual(expected);
  });
});

describe('describeItemDetails', () => {
  const options = { today: '2026-11-21' as LocalDate, isDone: false, nameOf: () => 'Bilal' };
  it('summarises grocery quantities and prices', () => {
    expect(
      describeItemDetails(
        { kind: 'grocery', value: { quantity: 5, unit: 'kg', pricePaise: 25000 } },
        options,
      ).summary,
    ).toBe('5 kg · ~₹250');
  });
  it('flags overdue open to-dos only', () => {
    const overdue = describeItemDetails(
      { kind: 'todo', value: { dueOn: '2026-11-20', assigneeId: 'b' } },
      options,
    );
    expect(overdue).toEqual({ summary: 'Due 20 Nov · Bilal', isOverdue: true });
    expect(
      describeItemDetails(
        { kind: 'todo', value: { dueOn: '2026-11-20' } },
        { ...options, isDone: true },
      ).isOverdue,
    ).toBe(false);
    expect(
      describeItemDetails({ kind: 'todo', value: { dueOn: '2026-11-21' } }, options).summary,
    ).toBe('Due today');
  });
  it('shows ratings and link hosts', () => {
    expect(
      describeItemDetails(
        { kind: 'watch', value: { rating: 4, link: 'https://www.imdb.com/x' } },
        options,
      ).summary,
    ).toBe('★★★★☆ · imdb.com');
  });
});

describe('detailsFromFields', () => {
  it('builds grocery details from text inputs and round-trips them', () => {
    const result = detailsFromFields('grocery', {
      ...EMPTY_DETAIL_FIELDS,
      quantity: '2',
      unit: 'kg',
      price: '120.50',
    });
    expect(result).toEqual({
      ok: true,
      details: { kind: 'grocery', value: { quantity: 2, unit: 'kg', pricePaise: 12050 } },
    });
    if (result.ok)
      expect(fieldsFromDetails(result.details)).toMatchObject({
        quantity: '2',
        unit: 'kg',
        price: '120.50',
      });
  });
  it('explains invalid inputs', () => {
    expect(detailsFromFields('grocery', { ...EMPTY_DETAIL_FIELDS, quantity: '-1' }).ok).toBe(false);
    expect(detailsFromFields('watch', { ...EMPTY_DETAIL_FIELDS, link: 'ftp://x' }).ok).toBe(false);
    expect(detailsFromFields('watch', { ...EMPTY_DETAIL_FIELDS, rating: '6' }).ok).toBe(false);
    expect(detailsFromFields('todo', { ...EMPTY_DETAIL_FIELDS, dueOn: '2026-02-30' }).ok).toBe(
      false,
    );
  });
  it('treats empty fields as no details', () => {
    expect(detailsFromFields('ideas', EMPTY_DETAIL_FIELDS)).toEqual({
      ok: true,
      details: { kind: 'ideas', value: {} },
    });
  });
});
