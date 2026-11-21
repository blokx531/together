import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { exportMyData } from '../../src/features/settings/data/exportData';
import { createPair } from './helpers';

it('exports more than the API cap and leaves the partner’s private items out', async () => {
  const { a, b, householdId } = await createPair();
  const createPrivateList = async (owner: typeof a) => {
    const { data, error } = await owner.client
      .from('lists')
      .insert({
        household_id: householdId,
        owner_user_id: owner.id,
        kind: 'custom',
        title: 'Private list',
        visibility: 'private',
        client_request_id: randomUUID(),
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  };
  const personal = await createPrivateList(a);
  const partner = await createPrivateList(b);
  const items = Array.from({ length: 1001 }, (_, index) => ({
    list_id: personal,
    text: `Item ${index}`,
    position: `a${index}`,
    client_request_id: randomUUID(),
  }));
  const { error: personalError } = await a.client.from('list_items').insert(items);
  if (personalError) throw personalError;
  const { error: partnerError } = await b.client.from('list_items').insert({
    list_id: partner,
    text: 'Partner private item',
    position: 'a0',
    client_request_id: randomUUID(),
  });
  if (partnerError) throw partnerError;

  const result = await exportMyData(a.client);
  expect(result.tables.list_items).toHaveLength(items.length);
  const exportedIds = result.tables.list_items.map((item) => {
    if (!item || typeof item !== 'object' || !('client_request_id' in item)) {
      throw new Error('Expected a list item with a request ID.');
    }
    return item.client_request_id;
  });
  expect(new Set(exportedIds)).toEqual(new Set(items.map((item) => item.client_request_id)));
});
