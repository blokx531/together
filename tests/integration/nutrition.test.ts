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

async function catalogFoodId(user: TestUser, sourceRef: string): Promise<string> {
  const { data, error } = await user.client
    .from('foods')
    .select('id')
    .eq('source_ref', sourceRef)
    .single();
  if (error) throw error;
  return data.id;
}

interface LogArgs {
  foodId: string;
  quantity: number;
  date?: string;
  mealType?: string;
  visibility?: 'private' | 'household';
  requestId?: string;
}

function logFood(user: TestUser, args: LogArgs) {
  return user.client.rpc('log_food', {
    p_client_request_id: args.requestId ?? randomUUID(),
    p_local_date: args.date ?? '2026-11-21',
    p_meal_type: args.mealType ?? 'lunch',
    p_custom_label: '',
    p_visibility: args.visibility ?? 'household',
    p_food_id: args.foodId,
    p_quantity: args.quantity,
    p_serving_label: '',
    p_serving_count: 1,
  });
}

async function dayTotal(viewer: TestUser, ownerId: string, date = '2026-11-21'): Promise<number> {
  const { data, error } = await viewer.client
    .from('meals')
    .select('meal_items(kcal)')
    .eq('owner_user_id', ownerId)
    .eq('local_date', date);
  if (error) throw error;
  return data.flatMap((meal) => meal.meal_items).reduce((sum, item) => sum + Number(item.kcal), 0);
}

describe('catalog', () => {
  it('offers licensed Indian foods with sources and servings', async () => {
    const user = await createTestUser('Cook');
    const { data } = await user.client
      .from('foods')
      .select('name, variant, kcal_per_basis, source_id, food_servings(label, amount)')
      .eq('source_ref', 'roti:home')
      .single();
    expect(data).toMatchObject({ name: 'Roti', source_id: 'katori', kcal_per_basis: 255 });
    expect(data?.food_servings).toEqual([{ label: '1 medium roti (40 g)', amount: 40 }]);
    const sources = await user.client.from('food_sources').select('id, license');
    expect(sources.data?.map((s) => s.id).sort()).toEqual(['cofid-2021', 'katori', 'user']);
  });

  it('finds foods by alias (chapati → roti, daal → dal)', async () => {
    const user = await createTestUser('Search');
    const chapati = await user.client
      .from('foods')
      .select('name')
      .ilike('search_text', '%chapati%');
    expect(chapati.data?.map((f) => f.name)).toContain('Roti');
    const daal = await user.client.from('foods').select('name').ilike('search_text', '%daal%');
    expect(daal.data?.map((f) => f.name)).toContain('Dal tadka');
  });
});

describe('meal logging', () => {
  it('logs 2 rotis + dal tadka + rice without AI and totals exactly; partner sees it', async () => {
    const { a, b } = await createPair();
    const roti = await catalogFoodId(a, 'roti:home');
    const dal = await catalogFoodId(a, 'dal-tadka:home');
    const rice = await catalogFoodId(a, 'rice:home');
    for (const args of [
      { foodId: roti, quantity: 80 },
      { foodId: dal, quantity: 150 },
      { foodId: rice, quantity: 120 },
    ]) {
      expect((await logFood(a, args)).error).toBeNull();
    }
    // 255×0.8 + 121×1.5 + 130×1.2 = 204 + 181.5 + 156
    expect(await dayTotal(a, a.id)).toBeCloseTo(541.5, 5);
    expect(await dayTotal(b, a.id)).toBeCloseTo(541.5, 5);
  });

  it('keeps private meals private', async () => {
    const { a, b } = await createPair();
    const samosa = await catalogFoodId(a, 'samosa:home');
    await logFood(a, { foodId: samosa, quantity: 90, mealType: 'snacks', visibility: 'private' });
    expect(await dayTotal(a, a.id)).toBeGreaterThan(0);
    expect(await dayTotal(b, a.id)).toBe(0);
    expect((await b.client.from('meal_items').select('id')).data).toEqual([]);
  });

  it('rejects a write when an existing meal has a different audience', async () => {
    const { a, b } = await createPair();
    const roti = await catalogFoodId(a, 'roti:home');
    const lunch = { foodId: roti, quantity: 40 };
    expect((await logFood(a, lunch)).error).toBeNull();
    expectDbError(await logFood(a, { ...lunch, visibility: 'private' }), 'STALE_MEAL_VISIBILITY');
    expect(await dayTotal(a, a.id)).toBe(102);
    expect(await dayTotal(b, a.id)).toBe(102);

    const dinner = { ...lunch, mealType: 'dinner' };
    expect((await logFood(a, { ...dinner, visibility: 'private' })).error).toBeNull();
    expectDbError(await logFood(a, dinner), 'STALE_MEAL_VISIBILITY');
    expect(await dayTotal(a, a.id)).toBe(204);
    expect(await dayTotal(b, a.id)).toBe(102);
  });

  it('saves only one of two simultaneous requests with conflicting meal visibility', async () => {
    const { a, b } = await createPair();
    const roti = await catalogFoodId(a, 'roti:home');
    const [shared, personal] = await Promise.all([
      logFood(a, { foodId: roti, quantity: 40, visibility: 'household' }),
      logFood(a, { foodId: roti, quantity: 40, visibility: 'private' }),
    ]);
    const [saved, rejected] = shared.error ? [personal, shared] : [shared, personal];
    expect(saved.error).toBeNull();
    expectDbError(rejected, 'STALE_MEAL_VISIBILITY');
    expect(await dayTotal(a, a.id)).toBe(102);
    expect(await dayTotal(b, a.id)).toBe(shared.error ? 0 : 102);
  });

  it('drops duplicate submissions', async () => {
    const { a } = await createPair();
    const idli = await catalogFoodId(a, 'idli:home');
    const requestId = randomUUID();
    await Promise.all([
      logFood(a, { foodId: idli, quantity: 100, requestId }),
      logFood(a, { foodId: idli, quantity: 100, requestId }),
    ]);
    await logFood(a, { foodId: idli, quantity: 100, requestId });
    expect((await a.client.from('meal_items').select('id')).data).toHaveLength(1);
  });

  it('recomputes calories when the portion changes', async () => {
    const { a } = await createPair();
    const roti = await catalogFoodId(a, 'roti:home');
    const itemId = (await logFood(a, { foodId: roti, quantity: 40 })).data ?? '';
    await a.client.from('meal_items').update({ quantity: 120, serving_count: 3 }).eq('id', itemId);
    expect(await dayTotal(a, a.id)).toBeCloseTo(306, 5);
  });

  it('snapshots values so editing a custom food never rewrites history', async () => {
    const { a, householdId } = await createPair();
    const custom = await a.client
      .from('foods')
      .insert({
        source_id: 'user',
        owner_user_id: a.id,
        household_id: householdId,
        name: 'Mom’s thepla',
        basis_unit: 'serving',
        basis_amount: 1,
        kcal_per_basis: 120,
        provenance: 'estimated',
      })
      .select('id')
      .single();
    expect(custom.error).toBeNull();
    await logFood(a, { foodId: custom.data?.id ?? '', quantity: 2 });
    await a.client
      .from('foods')
      .update({ kcal_per_basis: 200 })
      .eq('id', custom.data?.id ?? '');
    expect(await dayTotal(a, a.id)).toBe(240);
    const item = await a.client.from('meal_items').select('provenance, source_label').single();
    expect(item.data).toEqual({ provenance: 'estimated', source_label: 'Added by you' });
  });

  it("cannot log someone else's private custom food or fake catalog provenance", async () => {
    const { a, b } = await createPair();
    const secret = await b.client
      .from('foods')
      .insert({
        source_id: 'user',
        owner_user_id: b.id,
        name: 'Private snack',
        basis_unit: 'g',
        basis_amount: 100,
        kcal_per_basis: 500,
        provenance: 'measured',
      })
      .select('id')
      .single();
    expectDbError(
      await logFood(a, { foodId: secret.data?.id ?? '', quantity: 50 }),
      'FOOD_NOT_FOUND',
    );
    const fake = await a.client.from('foods').insert({
      source_id: 'katori',
      owner_user_id: null,
      name: 'Fake',
      basis_unit: 'g',
      basis_amount: 100,
      kcal_per_basis: 1,
      provenance: 'derived',
    });
    expectDbError(fake, /row-level security/);
  });

  it('copies a meal idempotently and moves meals by merging', async () => {
    const { a } = await createPair();
    const poha = await catalogFoodId(a, 'poha:home');
    const chai = await catalogFoodId(a, 'chai:home');
    await logFood(a, { foodId: poha, quantity: 140, mealType: 'breakfast', date: '2026-11-20' });
    await logFood(a, { foodId: chai, quantity: 158, mealType: 'breakfast', date: '2026-11-20' });
    const source = await a.client
      .from('meals')
      .select('id')
      .eq('local_date', '2026-11-20')
      .single();
    const requestId = randomUUID();
    const copy = () =>
      a.client.rpc('copy_meal', {
        p_source_meal_id: source.data?.id ?? '',
        p_target_date: '2026-11-21',
        p_target_meal_type: 'breakfast',
        p_target_custom_label: '',
        p_request_id: requestId,
      });
    await copy();
    await copy();
    expect(await dayTotal(a, a.id, '2026-11-21')).toBeCloseTo(
      await dayTotal(a, a.id, '2026-11-20'),
      5,
    );

    const today = await a.client.from('meals').select('id').eq('local_date', '2026-11-21').single();
    await logFood(a, { foodId: chai, quantity: 158, mealType: 'snacks', date: '2026-11-21' });
    await a.client.rpc('move_meal', {
      p_meal_id: today.data?.id ?? '',
      p_target_date: '2026-11-21',
      p_target_meal_type: 'snacks',
      p_target_custom_label: '',
    });
    const meals = await a.client
      .from('meals')
      .select('meal_type, meal_items(id)')
      .eq('local_date', '2026-11-21');
    expect(meals.data).toHaveLength(1);
    expect(meals.data?.[0]?.meal_items).toHaveLength(3);
  });

  it('leaves private items intact when copy or move targets a shared meal', async () => {
    const { a, b } = await createPair();
    const roti = await catalogFoodId(a, 'roti:home');
    const localDate = '2026-11-20';
    expect(
      (await logFood(a, { foodId: roti, quantity: 40, date: localDate, visibility: 'private' }))
        .error,
    ).toBeNull();
    expect((await logFood(a, { foodId: roti, quantity: 80 })).error).toBeNull();
    const { data: source, error } = await a.client
      .from('meals')
      .select('id')
      .eq('local_date', localDate)
      .single();
    if (error) throw error;
    const target = {
      p_target_date: '2026-11-21',
      p_target_meal_type: 'lunch',
      p_target_custom_label: '',
    };

    expectDbError(
      await a.client.rpc('copy_meal', {
        ...target,
        p_source_meal_id: source.id,
        p_request_id: randomUUID(),
      }),
      'STALE_MEAL_VISIBILITY',
    );
    expectDbError(
      await a.client.rpc('move_meal', { ...target, p_meal_id: source.id }),
      'STALE_MEAL_VISIBILITY',
    );

    expect(await dayTotal(a, a.id, localDate)).toBe(102);
    expect(await dayTotal(b, a.id, localDate)).toBe(0);
    expect(await dayTotal(b, a.id)).toBe(204);
  });

  it('removes a meal when its last item is deleted, and tracks day completeness', async () => {
    const { a, b } = await createPair();
    const dosa = await catalogFoodId(a, 'dosa:home');
    const itemId = (await logFood(a, { foodId: dosa, quantity: 54 })).data ?? '';
    await a.client.from('meal_items').delete().eq('id', itemId);
    expect((await a.client.from('meals').select('id')).data).toEqual([]);

    await a.client.rpc('set_day_complete', { p_local_date: '2026-11-21', p_is_complete: true });
    const seenByPartner = await b.client
      .from('nutrition_days')
      .select('is_complete')
      .eq('owner_user_id', a.id)
      .single();
    expect(seenByPartner.data?.is_complete).toBe(true);
  });

  it('outsiders and signed-out clients cannot read meals', async () => {
    const { a } = await createPair();
    await logFood(a, { foodId: await catalogFoodId(a, 'roti:home'), quantity: 40 });
    const outsider = await createTestUser('Peeker');
    await createHousehold(outsider);
    expect((await outsider.client.from('meals').select('id')).data).toEqual([]);
    expect((await outsider.client.from('meal_items').select('id')).data).toEqual([]);
    expect((await anonClient().from('meals').select('id')).data ?? []).toEqual([]);
  });
});

describe('weight privacy and history', () => {
  async function recordWeight(user: TestUser, date: string, kg: number) {
    return user.client.rpc('record_weight', {
      p_client_request_id: randomUUID(),
      p_local_date: date,
      p_weight_kg: kg,
      p_note: '',
    });
  }

  it('weigh-ins are private until shared; the energy profile is never shared', async () => {
    const { a, b } = await createPair();
    await recordWeight(b, '2026-11-14', 72.4);
    await b.client
      .from('energy_profiles')
      .insert({ user_id: b.id, height_cm: 170, birth_date: '1995-05-01', formula_sex: 'male' });
    expect((await a.client.from('weight_entries').select('id')).data).toEqual([]);
    expect((await a.client.rpc('partner_weight_shared')).data).toBe(false);

    await b.client
      .from('energy_profiles')
      .update({ weight_visibility: 'household' })
      .eq('user_id', b.id);
    expect((await a.client.from('weight_entries').select('weight_kg')).data).toEqual([
      { weight_kg: 72.4 },
    ]);
    expect((await a.client.rpc('partner_weight_shared')).data).toBe(true);
    expect((await a.client.from('energy_profiles').select('*').eq('user_id', b.id)).data).toEqual(
      [],
    );
  });

  it('rejects an upsert that would rewrite user_id (regression: profile save used upsert)', async () => {
    const { b } = await createPair();
    const upsert = await b.client
      .from('energy_profiles')
      .upsert({ user_id: b.id, maintenance_kcal_manual: 2300 });
    expectDbError(upsert, /permission denied/);
    // The adapter's update-then-insert path works.
    expect(
      (
        await b.client
          .from('energy_profiles')
          .insert({ user_id: b.id, maintenance_kcal_manual: 2300 })
      ).error,
    ).toBeNull();
    const update = await b.client
      .from('energy_profiles')
      .update({ maintenance_kcal_manual: 2400 })
      .eq('user_id', b.id)
      .select('maintenance_kcal_manual');
    expect(update.data).toEqual([{ maintenance_kcal_manual: 2400 }]);
  });

  it('a same-day correction keeps one entry and records the previous value', async () => {
    const { b } = await createPair();
    await recordWeight(b, '2026-11-21', 72.4);
    await recordWeight(b, '2026-11-21', 71.9);
    expect((await b.client.from('weight_entries').select('weight_kg')).data).toEqual([
      { weight_kg: 71.9 },
    ]);
    const revisions = await b.client.from('weight_entry_revisions').select('change, previous');
    expect(revisions.data).toHaveLength(1);
    expect(JSON.stringify(revisions.data?.[0]?.previous)).toContain('72.4');
  });

  it('goal changes add versions instead of overwriting, with direction checks', async () => {
    const { b } = await createPair();
    const goal = (target: number, effectiveFrom: string) =>
      b.client.from('weight_goals').insert({
        user_id: b.id,
        goal_type: 'lose',
        start_weight_kg: 75,
        start_date: '2026-11-01',
        target_weight_kg: target,
        effective_from: effectiveFrom,
      });
    expect((await goal(70, '2026-11-01')).error).toBeNull();
    expect((await goal(68, '2026-11-21')).error).toBeNull();
    expectDbError(await goal(80, '2026-11-22'), /weight_goals_target_direction/);
    const goals = await b.client
      .from('weight_goals')
      .select('target_weight_kg')
      .order('effective_from');
    expect(goals.data?.map((g) => g.target_weight_kg)).toEqual([70, 68]);
  });
});
