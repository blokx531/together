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

interface PlaceArgs {
  name?: string;
  visibility?: 'private' | 'household';
  wishlist?: boolean;
  visitors?: string[];
  requestId?: string;
}

function createPlace(user: TestUser, args: PlaceArgs = {}) {
  return user.client.rpc('create_place', {
    p_client_request_id: args.requestId ?? randomUUID(),
    p_name: args.name ?? 'Jaipur',
    p_locality: 'Jaipur',
    p_region: 'Rajasthan',
    p_country_code: 'in',
    p_country_name: 'India',
    p_latitude: 26.9124,
    p_longitude: 75.7873,
    p_source: 'manual',
    p_source_ref: '',
    p_visibility: args.visibility ?? 'household',
    p_is_wishlist: args.wishlist ?? false,
    ...(args.visitors
      ? {
          p_visit_started_on: '2025-12-24',
          p_visit_ended_on: '2025-12-27',
          p_visit_member_ids: args.visitors,
        }
      : {}),
  });
}

describe('places and visits', () => {
  it('stores a joint visit with coordinates, dates and both visitors', async () => {
    const { a, b } = await createPair();
    const placeId = (await createPlace(a, { visitors: [a.id, b.id] })).data ?? '';
    const seenByB = await b.client
      .from('places')
      .select(
        'name, country_code, latitude, longitude, is_wishlist, visits(started_on, ended_on, visit_members(user_id))',
      )
      .eq('id', placeId)
      .single();
    expect(seenByB.data).toMatchObject({
      name: 'Jaipur',
      country_code: 'IN',
      latitude: 26.9124,
      longitude: 75.7873,
      is_wishlist: false,
    });
    expect(seenByB.data?.visits[0]).toMatchObject({
      started_on: '2025-12-24',
      ended_on: '2025-12-27',
    });
    expect(seenByB.data?.visits[0]?.visit_members.map((m) => m.user_id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
  });

  it('keeps wishlist places without visits', async () => {
    const { a } = await createPair();
    const placeId = (await createPlace(a, { name: 'Kyoto', wishlist: true })).data ?? '';
    const place = await a.client
      .from('places')
      .select('is_wishlist, visits(id)')
      .eq('id', placeId)
      .single();
    expect(place.data).toEqual({ is_wishlist: true, visits: [] });
  });

  it('is idempotent per request id, including the first visit', async () => {
    const { a } = await createPair();
    const requestId = randomUUID();
    await Promise.all([
      createPlace(a, { requestId, visitors: [a.id] }),
      createPlace(a, { requestId, visitors: [a.id] }),
    ]);
    await createPlace(a, { requestId, visitors: [a.id] });
    expect((await a.client.from('places').select('id')).data).toHaveLength(1);
    expect((await a.client.from('visits').select('id')).data).toHaveLength(1);
  });

  it('private places are invisible to the partner and record only their creator', async () => {
    const { a, b } = await createPair();
    expectDbError(
      await createPlace(a, { visibility: 'private', visitors: [a.id, b.id] }),
      'PRIVATE_PLACE_SINGLE_VISITOR',
    );
    const placeId = (await createPlace(a, { visibility: 'private', visitors: [a.id] })).data ?? '';
    expect((await b.client.from('places').select('id').eq('id', placeId)).data).toEqual([]);
    expect((await b.client.from('visits').select('id')).data).toEqual([]);
  });

  it('only household members can be recorded as visitors', async () => {
    const { a } = await createPair();
    const outsider = await createTestUser('Tourist');
    expectDbError(await createPlace(a, { visitors: [a.id, outsider.id] }), 'VISITOR_NOT_MEMBER');
  });

  it('adds later visits to the same place', async () => {
    const { a, b } = await createPair();
    const placeId = (await createPlace(a, { visitors: [a.id] })).data ?? '';
    const visit = await b.client.rpc('add_visit', {
      p_client_request_id: randomUUID(),
      p_place_id: placeId,
      p_started_on: '2026-10-02',
      p_ended_on: '2026-10-01',
      p_note: '',
      p_member_ids: [b.id],
    });
    expectDbError(visit, /visits_dates/);
    const ok = await b.client.rpc('add_visit', {
      p_client_request_id: randomUUID(),
      p_place_id: placeId,
      p_started_on: '2026-10-02',
      p_ended_on: '2026-10-04',
      p_note: 'Diwali trip',
      p_member_ids: [b.id],
    });
    expect(ok.error).toBeNull();
    expect((await a.client.from('visits').select('id').eq('place_id', placeId)).data).toHaveLength(
      2,
    );
  });

  it('outsiders and signed-out clients see nothing', async () => {
    const { a, b } = await createPair();
    await createPlace(a, { visitors: [a.id, b.id] });
    const outsider = await createTestUser('Stranger');
    await createHousehold(outsider);
    expect((await outsider.client.from('places').select('id')).data).toEqual([]);
    expect((await outsider.client.from('visit_members').select('user_id')).data).toEqual([]);
    expect((await anonClient().from('places').select('id')).data ?? []).toEqual([]);
  });
});
