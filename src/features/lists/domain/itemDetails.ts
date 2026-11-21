import * as z from 'zod/mini';
import { paiseToInputValue, parseRupeesToPaise } from '@/shared/lib/money';
import type { ListKind } from './listKinds';

/**
 * Type-specific item details. The same rules are enforced by the `validate_list_item` trigger;
 * this schema validates rows read back from the database (jsonb is untyped) and form input.
 */
const MAX_QUANTITY = 100_000;
const MAX_UNIT_LENGTH = 12;
const MAX_LINK_LENGTH = 500;
const MAX_PRICE_PAISE = 10_000_000_000;

const link = z.url({ protocol: /^https?$/ }).check(z.maxLength(MAX_LINK_LENGTH));

const groceryDetails = z.strictObject({
  quantity: z.optional(z.number().check(z.gt(0), z.lte(MAX_QUANTITY))),
  unit: z.optional(z.string().check(z.maxLength(MAX_UNIT_LENGTH))),
  pricePaise: z.optional(z.int().check(z.gte(0), z.lte(MAX_PRICE_PAISE))),
});
const todoDetails = z.strictObject({
  dueOn: z.optional(z.iso.date()),
  assigneeId: z.optional(z.uuid()),
});
const watchDetails = z.strictObject({
  rating: z.optional(z.int().check(z.gte(1), z.lte(5))),
  link: z.optional(link),
});
const ideasDetails = z.strictObject({ link: z.optional(link) });
const noDetails = z.strictObject({});

export type GroceryDetails = z.infer<typeof groceryDetails>;
export type TodoDetails = z.infer<typeof todoDetails>;
export type WatchDetails = z.infer<typeof watchDetails>;
export type IdeasDetails = z.infer<typeof ideasDetails>;

export type ItemDetails =
  | { kind: 'grocery'; value: GroceryDetails }
  | { kind: 'todo'; value: TodoDetails }
  | { kind: 'watch'; value: WatchDetails }
  | { kind: 'ideas'; value: IdeasDetails }
  | { kind: 'packing' | 'custom'; value: Record<string, never> };

/** Parses stored details for a list kind. Unknown or malformed data degrades to "no details". */
export function parseItemDetails(kind: ListKind, raw: unknown): ItemDetails {
  switch (kind) {
    case 'grocery': {
      const result = groceryDetails.safeParse(raw);
      return { kind, value: result.success ? result.data : {} };
    }
    case 'todo': {
      const result = todoDetails.safeParse(raw);
      return { kind, value: result.success ? result.data : {} };
    }
    case 'watch': {
      const result = watchDetails.safeParse(raw);
      return { kind, value: result.success ? result.data : {} };
    }
    case 'ideas': {
      const result = ideasDetails.safeParse(raw);
      return { kind, value: result.success ? result.data : {} };
    }
    case 'packing':
    case 'custom':
      noDetails.parse({});
      return { kind, value: {} };
  }
}

export function isValidLink(value: string): boolean {
  return link.safeParse(value).success;
}

const QUICK_ADD_QUANTITY =
  /^(.*?)\s+(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pcs?|packs?|dozen|bunch(?:es)?)?$/i;

/**
 * Lets grocery quick-add understand "Atta 5 kg" or "Eggs 12": the trailing number and optional
 * unit become details. Anything else stays plain text.
 */
export function parseGroceryQuickAdd(input: string): { text: string; details: GroceryDetails } {
  const trimmed = input.trim();
  const match = QUICK_ADD_QUANTITY.exec(trimmed);
  const name = match?.[1]?.trim();
  const quantity = match?.[2] === undefined ? Number.NaN : Number(match[2]);
  if (!name || !Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    return { text: trimmed, details: {} };
  }
  const unit = match?.[3]?.toLowerCase();
  return { text: name, details: unit ? { quantity, unit } : { quantity } };
}

/** Raw form inputs for the item editor; every field is a string so inputs stay controlled. */
export interface DetailFields {
  quantity: string;
  unit: string;
  price: string;
  dueOn: string;
  assigneeId: string;
  rating: string;
  link: string;
}

export const EMPTY_DETAIL_FIELDS: DetailFields = {
  quantity: '',
  unit: '',
  price: '',
  dueOn: '',
  assigneeId: '',
  rating: '',
  link: '',
};

export function fieldsFromDetails(details: ItemDetails): DetailFields {
  switch (details.kind) {
    case 'grocery':
      return {
        ...EMPTY_DETAIL_FIELDS,
        quantity: details.value.quantity?.toString() ?? '',
        unit: details.value.unit ?? '',
        price:
          details.value.pricePaise === undefined ? '' : paiseToInputValue(details.value.pricePaise),
      };
    case 'todo':
      return {
        ...EMPTY_DETAIL_FIELDS,
        dueOn: details.value.dueOn ?? '',
        assigneeId: details.value.assigneeId ?? '',
      };
    case 'watch':
      return {
        ...EMPTY_DETAIL_FIELDS,
        rating: details.value.rating?.toString() ?? '',
        link: details.value.link ?? '',
      };
    case 'ideas':
      return { ...EMPTY_DETAIL_FIELDS, link: details.value.link ?? '' };
    case 'packing':
    case 'custom':
      return EMPTY_DETAIL_FIELDS;
  }
}

export type DetailsFromFieldsResult =
  { ok: true; details: ItemDetails } | { ok: false; error: string };

function optionalLink(input: string): { ok: true; value?: string } | { ok: false } {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true };
  return isValidLink(trimmed) ? { ok: true, value: trimmed } : { ok: false };
}

/** Validates editor inputs into typed details, with a message for the first problem found. */
export function detailsFromFields(kind: ListKind, fields: DetailFields): DetailsFromFieldsResult {
  switch (kind) {
    case 'grocery': {
      const value: GroceryDetails = {};
      if (fields.quantity.trim() !== '') {
        const quantity = Number(fields.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
          return { ok: false, error: 'Quantity must be a positive number.' };
        }
        value.quantity = quantity;
      }
      if (fields.unit.trim() !== '') value.unit = fields.unit.trim().slice(0, MAX_UNIT_LENGTH);
      if (fields.price.trim() !== '') {
        const pricePaise = parseRupeesToPaise(fields.price);
        if (pricePaise === null) return { ok: false, error: 'Enter a price like 120 or 99.50.' };
        value.pricePaise = pricePaise;
      }
      return { ok: true, details: { kind, value } };
    }
    case 'todo': {
      const value: TodoDetails = {};
      if (fields.dueOn !== '') {
        if (!z.iso.date().safeParse(fields.dueOn).success)
          return { ok: false, error: 'Choose a valid due date.' };
        value.dueOn = fields.dueOn;
      }
      if (fields.assigneeId !== '') value.assigneeId = fields.assigneeId;
      return { ok: true, details: { kind, value } };
    }
    case 'watch': {
      const value: WatchDetails = {};
      if (fields.rating !== '') {
        const rating = Number(fields.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5)
          return { ok: false, error: 'Rating is 1 to 5 stars.' };
        value.rating = rating;
      }
      const parsedLink = optionalLink(fields.link);
      if (!parsedLink.ok) return { ok: false, error: 'Links must start with https:// or http://.' };
      if (parsedLink.value) value.link = parsedLink.value;
      return { ok: true, details: { kind, value } };
    }
    case 'ideas': {
      const parsedLink = optionalLink(fields.link);
      if (!parsedLink.ok) return { ok: false, error: 'Links must start with https:// or http://.' };
      return {
        ok: true,
        details: { kind, value: parsedLink.value ? { link: parsedLink.value } : {} },
      };
    }
    case 'packing':
    case 'custom':
      return { ok: true, details: { kind, value: {} } };
  }
}
