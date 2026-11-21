import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  anonClient,
  createHousehold,
  createPair,
  createTestUser,
  expectDbError,
  type TestUser,
} from './helpers';

async function createList(
  owner: TestUser,
  householdId: string,
  options: { visibility: 'private' | 'household'; kind?: string },
) {
  const { data, error } = await owner.client
    .from('lists')
    .insert({
      household_id: householdId,
      owner_user_id: owner.id,
      visibility: options.visibility,
      kind: options.kind ?? 'grocery',
      title: 'List',
      client_request_id: randomUUID(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function addItem(
  user: TestUser,
  listId: string,
  text: string,
  position: string,
  details: object = {},
) {
  return user.client
    .from('list_items')
    .insert({
      list_id: listId,
      text,
      position,
      details: { ...details },
      client_request_id: randomUUID(),
    })
    .select('id, revision, created_by')
    .single();
}

describe('list visibility', () => {
  it('private lists and their items are invisible and read-only to the partner', async () => {
    const { a, b, householdId } = await createPair();
    const listId = await createList(a, householdId, { visibility: 'private' });
    await addItem(a, listId, 'Secret gift', 'a0');

    expect((await b.client.from('lists').select('id').eq('id', listId)).data).toEqual([]);
    expect((await b.client.from('list_items').select('id').eq('list_id', listId)).data).toEqual([]);
    const intrusion = await addItem(b, listId, 'Peek', 'a1');
    expectDbError(intrusion, /row-level security/);
  });

  it('shared lists are editable by both, with attribution', async () => {
    const { a, b, householdId } = await createPair();
    const listId = await createList(a, householdId, { visibility: 'household' });
    const item = await addItem(b, listId, 'Milk', 'a0', { quantity: 2, unit: 'l' });
    expect(item.error).toBeNull();
    expect(item.data?.created_by).toBe(b.id);

    await a.client
      .from('list_items')
      .update({ is_done: true })
      .eq('id', item.data?.id ?? '');
    const seenByB = await b.client
      .from('list_items')
      .select('is_done, done_by')
      .eq('id', item.data?.id ?? '')
      .single();
    expect(seenByB.data).toEqual({ is_done: true, done_by: a.id });
  });

  it('only the owner can change visibility or delete a shared list', async () => {
    const { a, b, householdId } = await createPair();
    const listId = await createList(a, householdId, { visibility: 'household' });
    expectDbError(
      await b.client.from('lists').update({ visibility: 'private' }).eq('id', listId),
      'ONLY_OWNER_CHANGES_VISIBILITY',
    );
    expect(
      (await b.client.from('lists').update({ title: 'Renamed by B' }).eq('id', listId)).error,
    ).toBeNull();
    const deletion = await b.client.from('lists').delete().eq('id', listId).select('id');
    expect(deletion.data).toEqual([]);
    expect(
      (await a.client.from('lists').select('title').eq('id', listId).single()).data?.title,
    ).toBe('Renamed by B');
  });

  it('outsiders and signed-out clients see nothing', async () => {
    const { a, householdId } = await createPair();
    const listId = await createList(a, householdId, { visibility: 'household' });
    await addItem(a, listId, 'Rice', 'a0');
    const outsider = await createTestUser('Nosy');
    await createHousehold(outsider);
    expect((await outsider.client.from('lists').select('id')).data).toEqual([]);
    expect((await outsider.client.from('list_items').select('id')).data).toEqual([]);
    expectDbError(await addItem(outsider, listId, 'Spam', 'a1'), /row-level security/);
    expect((await anonClient().from('list_items').select('id')).data ?? []).toEqual([]);
  });
});

describe('collaboration safety', () => {
  it('a stale text edit matches no row instead of overwriting the partner', async () => {
    const { a, b, householdId } = await createPair();
    const listId = await createList(a, householdId, { visibility: 'household', kind: 'todo' });
    const item = await addItem(a, listId, 'Call plumber', 'a0');
    const loadedRevision = item.data?.revision ?? 0;
    const id = item.data?.id ?? '';

    const first = await a.client
      .from('list_items')
      .update({ text: 'Call plumber at 5' })
      .eq('id', id)
      .eq('revision', loadedRevision)
      .select('id');
    expect(first.data).toHaveLength(1);
    const second = await b.client
      .from('list_items')
      .update({ text: 'Call electrician' })
      .eq('id', id)
      .eq('revision', loadedRevision)
      .select('id');
    expect(second.data).toEqual([]);
    expect(
      (await b.client.from('list_items').select('text, revision').eq('id', id).single()).data,
    ).toEqual({
      text: 'Call plumber at 5',
      revision: 2,
    });
  });

  it('duplicate inserts with the same request id create one item', async () => {
    const { a, householdId } = await createPair();
    const listId = await createList(a, householdId, { visibility: 'household' });
    const requestId = randomUUID();
    const insert = () =>
      a.client
        .from('list_items')
        .upsert(
          { list_id: listId, text: 'Eggs', position: 'a0', client_request_id: requestId },
          { onConflict: 'client_request_id', ignoreDuplicates: true },
        );
    await Promise.all([insert(), insert(), insert()]);
    expect(
      (await a.client.from('list_items').select('id').eq('list_id', listId)).data,
    ).toHaveLength(1);
  });

  it('orders items byte-wise by position', async () => {
    const { a, householdId } = await createPair();
    const listId = await createList(a, householdId, { visibility: 'household' });
    await addItem(a, listId, 'third', 'a2');
    await addItem(a, listId, 'first', 'Zz');
    await addItem(a, listId, 'second', 'a0');
    const items = await a.client
      .from('list_items')
      .select('text')
      .eq('list_id', listId)
      .order('position');
    expect(items.data?.map((i) => i.text)).toEqual(['first', 'second', 'third']);
  });
});

describe('typed details', () => {
  it('accepts valid preset details and rejects unknown keys or bad values', async () => {
    const { a, householdId } = await createPair();
    const grocery = await createList(a, householdId, { visibility: 'household', kind: 'grocery' });
    expect(
      (await addItem(a, grocery, 'Atta', 'a0', { quantity: 5, unit: 'kg', pricePaise: 25000 }))
        .error,
    ).toBeNull();
    expectDbError(await addItem(a, grocery, 'Bad', 'a1', { rating: 5 }), 'INVALID_ITEM_DETAILS');
    expectDbError(await addItem(a, grocery, 'Bad', 'a2', { quantity: -2 }), 'INVALID_ITEM_DETAILS');

    const watch = await createList(a, householdId, { visibility: 'household', kind: 'watch' });
    expectDbError(
      await addItem(a, watch, 'Film', 'a0', { link: 'javascript:alert(1)' }),
      'INVALID_ITEM_DETAILS',
    );
    expect(
      (await addItem(a, watch, 'Film', 'a1', { rating: 4, link: 'https://example.com/film' }))
        .error,
    ).toBeNull();
  });

  it('only household members can be assigned to-dos', async () => {
    const { a, b, householdId } = await createPair();
    const todo = await createList(a, householdId, { visibility: 'household', kind: 'todo' });
    expect(
      (await addItem(a, todo, 'Pay rent', 'a0', { assigneeId: b.id, dueOn: '2026-12-01' })).error,
    ).toBeNull();
    const outsider = await createTestUser('Helper');
    expectDbError(
      await addItem(a, todo, 'Fix tap', 'a1', { assigneeId: outsider.id }),
      'ASSIGNEE_NOT_MEMBER',
    );
  });
});
