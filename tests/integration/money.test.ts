import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Json } from '../../src/shared/types/database';
import {
  anonClient,
  createHousehold,
  createPair,
  createTestUser,
  expectDbError,
  type TestClient,
  type TestUser,
} from './helpers';

interface ExpenseArgs {
  requestId?: string;
  expenseId?: string | null;
  expectedVersion?: number | null;
  payer: string;
  scope?: 'personal' | 'shared';
  visibility?: 'private' | 'household';
  method?: string;
  amount: number;
  splits: { user_id: string; share_paise: number }[];
  spentOn?: string;
}

function saveExpense(client: TestClient, args: ExpenseArgs) {
  return client.rpc('save_expense', {
    p_client_request_id: args.requestId ?? randomUUID(),
    p_payer_user_id: args.payer,
    p_scope: args.scope ?? 'shared',
    p_visibility: args.visibility ?? 'household',
    p_split_method: args.method ?? (args.scope === 'personal' ? 'personal' : 'equal'),
    p_amount_paise: args.amount,
    p_category: 'groceries',
    p_title: 'Groceries',
    p_note: '',
    p_spent_on: args.spentOn ?? '2026-11-21',
    p_splits: args.splits as unknown as Json,
    ...(args.expenseId
      ? { p_expense_id: args.expenseId, p_expected_version: args.expectedVersion ?? 0 }
      : {}),
  });
}

function equalShared(payer: TestUser, other: TestUser, amount: number): ExpenseArgs {
  const payerShare = Math.ceil(amount / 2);
  return {
    payer: payer.id,
    amount,
    splits: [
      { user_id: payer.id, share_paise: payerShare },
      { user_id: other.id, share_paise: amount - payerShare },
    ],
  };
}

async function nets(client: TestClient): Promise<Record<string, number>> {
  const { data, error } = await client.rpc('household_balances');
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.user_id, row.net_paise]));
}

async function expenseTotal(client: TestClient): Promise<number> {
  const { data, error } = await client
    .from('expenses')
    .select('amount_paise')
    .is('voided_at', null);
  if (error) throw error;
  return data.reduce((sum, row) => sum + row.amount_paise, 0);
}

describe('shared expenses and balances', () => {
  it('₹1,200 split equally: B owes A ₹600, and both see the same balance', async () => {
    const { a, b } = await createPair();
    const saved = await saveExpense(a.client, equalShared(a, b, 120000));
    expect(saved.error).toBeNull();
    for (const viewer of [a, b]) {
      expect(await nets(viewer.client)).toEqual({ [a.id]: 60000, [b.id]: -60000 });
    }
  });

  it('settling ₹600 zeroes the balance without changing spending', async () => {
    const { a, b } = await createPair();
    await saveExpense(a.client, equalShared(a, b, 120000));
    const settlement = await b.client.rpc('record_settlement', {
      p_client_request_id: randomUUID(),
      p_from_user_id: b.id,
      p_to_user_id: a.id,
      p_amount_paise: 60000,
      p_settled_on: '2026-11-22',
      p_note: 'UPI',
    });
    expect(settlement.error).toBeNull();
    expect(await nets(a.client)).toEqual({ [a.id]: 0, [b.id]: 0 });
    expect(await expenseTotal(b.client)).toBe(120000);
  });

  it('nets debts in opposite directions', async () => {
    const { a, b } = await createPair();
    await saveExpense(a.client, equalShared(a, b, 1000)); // B owes A 500
    await saveExpense(b.client, equalShared(b, a, 600)); // A owes B 300
    const result = await nets(a.client);
    expect(result).toEqual({ [a.id]: 200, [b.id]: -200 });
    expect((result[a.id] ?? 0) + (result[b.id] ?? 0)).toBe(0);
  });

  it('assigns odd paise exactly and balances always sum to zero', async () => {
    const { a, b } = await createPair();
    await saveExpense(a.client, equalShared(a, b, 1001));
    await saveExpense(b.client, {
      payer: b.id,
      amount: 333,
      method: 'percent',
      splits: [
        { user_id: b.id, share_paise: 111 },
        { user_id: a.id, share_paise: 222 },
      ],
    });
    const result = await nets(b.client);
    expect((result[a.id] ?? 0) + (result[b.id] ?? 0)).toBe(0);
    expect(result[a.id]).toBe(500 - 222);
  });

  it('accepts the maximum amount and rejects anything larger', async () => {
    const { a, b } = await createPair();
    expect((await saveExpense(a.client, equalShared(a, b, 10_000_000_000))).error).toBeNull();
    const tooLarge = await saveExpense(a.client, equalShared(a, b, 10_000_000_001));
    expectDbError(tooLarge, /expenses_amount_paise_check/);
  });
});

describe('integrity', () => {
  it('rejects splits that do not add up, saving nothing', async () => {
    const { a, b } = await createPair();
    const result = await saveExpense(a.client, {
      payer: a.id,
      amount: 1000,
      splits: [
        { user_id: a.id, share_paise: 500 },
        { user_id: b.id, share_paise: 499 },
      ],
    });
    expectDbError(result, 'SPLITS_DO_NOT_SUM');
    expect(await expenseTotal(a.client)).toBe(0);
  });

  it('rejects a direct insert without splits', async () => {
    const { a, householdId } = await createPair();
    const result = await a.client.from('expenses').insert({
      household_id: householdId,
      created_by: a.id,
      payer_user_id: a.id,
      scope: 'shared',
      visibility: 'household',
      split_method: 'equal',
      amount_paise: 1000,
      category: 'groceries',
      title: 'Sneaky',
      spent_on: '2026-11-21',
      client_request_id: randomUUID(),
    });
    expectDbError(result, 'SPLITS_DO_NOT_SUM');
  });

  it('rejects participants from outside the household', async () => {
    const { a } = await createPair();
    const outsider = await createTestUser('Stranger');
    const result = await saveExpense(a.client, {
      payer: a.id,
      amount: 1000,
      splits: [
        { user_id: a.id, share_paise: 500 },
        { user_id: outsider.id, share_paise: 500 },
      ],
    });
    expectDbError(result, 'SPLIT_USER_NOT_MEMBER');
  });

  it('drops duplicate submissions, including concurrent ones', async () => {
    const { a, b } = await createPair();
    const requestId = randomUUID();
    const args = { ...equalShared(a, b, 5000), requestId };
    const first = await saveExpense(a.client, args);
    const retry = await saveExpense(a.client, args);
    expect(retry.data).toBe(first.data);

    const raceId = randomUUID();
    const raced = await Promise.all(
      [1, 2, 3].map(() => saveExpense(a.client, { ...equalShared(a, b, 7000), requestId: raceId })),
    );
    expect(new Set(raced.map((r) => r.data)).size).toBe(1);
    expect(await expenseTotal(a.client)).toBe(12000);
  });

  it('drops duplicate settlements', async () => {
    const { a, b } = await createPair();
    await saveExpense(a.client, equalShared(a, b, 2000));
    const requestId = randomUUID();
    const settle = () =>
      b.client.rpc('record_settlement', {
        p_client_request_id: requestId,
        p_from_user_id: b.id,
        p_to_user_id: a.id,
        p_amount_paise: 1000,
        p_settled_on: '2026-11-22',
        p_note: '',
      });
    await Promise.all([settle(), settle()]);
    await settle();
    expect(await nets(a.client)).toEqual({ [a.id]: 0, [b.id]: 0 });
  });

  it('rejects settlements with non-members or the same person twice', async () => {
    const { a } = await createPair();
    const outsider = await createTestUser('Payee');
    const base = {
      p_client_request_id: randomUUID(),
      p_amount_paise: 100,
      p_settled_on: '2026-11-22',
      p_note: '',
    };
    expectDbError(
      await a.client.rpc('record_settlement', {
        ...base,
        p_from_user_id: a.id,
        p_to_user_id: outsider.id,
      }),
      'SETTLEMENT_USER_NOT_MEMBER',
    );
    expectDbError(
      await a.client.rpc('record_settlement', {
        ...base,
        p_client_request_id: randomUUID(),
        p_from_user_id: a.id,
        p_to_user_id: a.id,
      }),
      /settlements_distinct_people/,
    );
  });
});

describe('editing, voiding and history', () => {
  it('recomputes balances after an edit and records the previous version', async () => {
    const { a, b } = await createPair();
    const created = await saveExpense(a.client, equalShared(a, b, 120000));
    const id = created.data ?? '';
    const edited = await saveExpense(b.client, {
      ...equalShared(a, b, 90000),
      expenseId: id,
      expectedVersion: 1,
    });
    expect(edited.error).toBeNull();
    expect(await nets(a.client)).toEqual({ [a.id]: 45000, [b.id]: -45000 });

    const revisions = await a.client
      .from('expense_revisions')
      .select('change, changed_by, previous')
      .eq('expense_id', id);
    expect(revisions.data).toHaveLength(1);
    expect(revisions.data?.[0]).toMatchObject({ change: 'update', changed_by: b.id });
    expect(JSON.stringify(revisions.data?.[0]?.previous)).toContain('120000');
  });

  it('rejects an edit based on a stale version', async () => {
    const { a, b } = await createPair();
    const id = (await saveExpense(a.client, equalShared(a, b, 1000))).data ?? '';
    await saveExpense(a.client, { ...equalShared(a, b, 2000), expenseId: id, expectedVersion: 1 });
    const stale = await saveExpense(b.client, {
      ...equalShared(a, b, 3000),
      expenseId: id,
      expectedVersion: 1,
    });
    expectDbError(stale, 'STALE_EXPENSE');
    expect(await expenseTotal(a.client)).toBe(2000);
  });

  it('voiding restores balances; restoring brings them back; voided_by cannot be spoofed', async () => {
    const { a, b } = await createPair();
    const id = (await saveExpense(a.client, equalShared(a, b, 1000))).data ?? '';
    expect(
      (
        await b.client.rpc('set_expense_voided', {
          p_expense_id: id,
          p_expected_version: 1,
          p_voided: true,
        })
      ).error,
    ).toBeNull();
    expect(await nets(a.client)).toEqual({ [a.id]: 0, [b.id]: 0 });
    const voided = await a.client
      .from('expenses')
      .select('voided_by, version')
      .eq('id', id)
      .single();
    expect(voided.data?.voided_by).toBe(b.id);

    expect(
      (
        await a.client.rpc('set_expense_voided', {
          p_expense_id: id,
          p_expected_version: 2,
          p_voided: false,
        })
      ).error,
    ).toBeNull();
    expect(await nets(b.client)).toEqual({ [a.id]: 500, [b.id]: -500 });
  });
});

describe('personal expenses and privacy', () => {
  it('private personal expenses are invisible to the partner and never affect balances', async () => {
    const { a, b } = await createPair();
    const saved = await saveExpense(a.client, {
      payer: a.id,
      scope: 'personal',
      visibility: 'private',
      amount: 4500,
      splits: [{ user_id: a.id, share_paise: 4500 }],
    });
    expect(saved.error).toBeNull();
    expect(await expenseTotal(a.client)).toBe(4500);
    expect(await expenseTotal(b.client)).toBe(0);
    const direct = await b.client
      .from('expenses')
      .select('id')
      .eq('id', saved.data ?? '');
    expect(direct.data).toEqual([]);
    const splits = await b.client
      .from('expense_splits')
      .select('*')
      .eq('expense_id', saved.data ?? '');
    expect(splits.data).toEqual([]);
    expect(await nets(b.client)).toEqual({ [a.id]: 0, [b.id]: 0 });
  });

  it('a personal expense cannot allocate to the partner or be recorded for them', async () => {
    const { a, b } = await createPair();
    const withPartner = await saveExpense(a.client, {
      payer: a.id,
      scope: 'personal',
      amount: 1000,
      splits: [
        { user_id: a.id, share_paise: 500 },
        { user_id: b.id, share_paise: 500 },
      ],
    });
    expectDbError(withPartner, 'PERSONAL_EXPENSE_INVALID');
    const forPartner = await saveExpense(a.client, {
      payer: b.id,
      scope: 'personal',
      amount: 1000,
      splits: [{ user_id: b.id, share_paise: 1000 }],
    });
    expectDbError(forPartner, 'PERSONAL_EXPENSE_INVALID');
  });

  it('shared expenses cannot be private', async () => {
    const { a, b } = await createPair();
    const result = await saveExpense(a.client, {
      ...equalShared(a, b, 1000),
      visibility: 'private',
    });
    expectDbError(result, /expenses_shared_is_household_visible/);
  });

  it("the partner cannot edit someone else's visible personal expense", async () => {
    const { a, b } = await createPair();
    const id =
      (
        await saveExpense(a.client, {
          payer: a.id,
          scope: 'personal',
          amount: 1000,
          splits: [{ user_id: a.id, share_paise: 1000 }],
        })
      ).data ?? '';
    const edit = await b.client.from('expenses').update({ title: 'Changed' }).eq('id', id).select();
    expect(edit.data).toEqual([]);
    const viaRpc = await saveExpense(b.client, {
      payer: a.id,
      scope: 'personal',
      amount: 1,
      splits: [{ user_id: a.id, share_paise: 1 }],
      expenseId: id,
      expectedVersion: 1,
    });
    expectDbError(viaRpc, 'NOT_ALLOWED');
  });
});

describe('outsiders', () => {
  it('cannot read, write into, or compute balances for another household', async () => {
    const { a, b, householdId } = await createPair();
    await saveExpense(a.client, equalShared(a, b, 120000));
    const outsider = await createTestUser('Outsider');
    await createHousehold(outsider);

    expect((await outsider.client.from('expenses').select('id')).data).toEqual([]);
    expect((await outsider.client.from('expense_splits').select('*')).data).toEqual([]);
    expect((await outsider.client.from('settlements').select('*')).data).toEqual([]);
    const outsiderBalances = await outsider.client.rpc('household_balances');
    expect(outsiderBalances.data?.map((r) => r.user_id)).toEqual([outsider.id]);

    const intrusion = await outsider.client.from('expenses').insert({
      household_id: householdId,
      created_by: outsider.id,
      payer_user_id: outsider.id,
      scope: 'personal',
      visibility: 'household',
      split_method: 'personal',
      amount_paise: 100,
      category: 'groceries',
      title: 'Intrusion',
      spent_on: '2026-11-21',
      client_request_id: randomUUID(),
    });
    expectDbError(intrusion, /row-level security/);
  });

  it('signed-out clients get nothing', async () => {
    const { a, b } = await createPair();
    await saveExpense(a.client, equalShared(a, b, 1000));
    const anon = anonClient();
    expect((await anon.from('expenses').select('id')).data ?? []).toEqual([]);
    expectDbError(await anon.rpc('household_balances'), /permission denied/);
  });
});
