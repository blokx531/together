import { describe, expect, it } from 'vitest';
import {
  anonClient,
  createHousehold,
  createInvitationToken,
  createPair,
  createTestUser,
  expectDbError,
  withDb,
} from './helpers';

describe('profiles', () => {
  it('creates a profile with the sign-up display name and no email column', async () => {
    const user = await createTestUser('Meera');
    const { data, error } = await user.client
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    expect(error).toBeNull();
    expect(data?.display_name).toBe('Meera');
    expect(data?.time_zone).toBe('Asia/Kolkata');
    expect(data?.default_meal_visibility).toBe('private');
    expect(Object.keys(data ?? {})).not.toContain('email');
  });

  it('rejects an invalid time zone', async () => {
    const user = await createTestUser('Tz');
    const result = await user.client
      .from('profiles')
      .update({ time_zone: 'Mars/Olympus' })
      .eq('user_id', user.id);
    expectDbError(result, 'INVALID_TIME_ZONE');
  });

  it('does not let a user rename someone else', async () => {
    const { a, b } = await createPair();
    const result = await b.client
      .from('profiles')
      .update({ display_name: 'Hacked' })
      .eq('user_id', a.id)
      .select();
    expect(result.data).toEqual([]);
    const check = await a.client
      .from('profiles')
      .select('display_name')
      .eq('user_id', a.id)
      .single();
    expect(check.data?.display_name).toBe('Asha');
  });
});

describe('household creation', () => {
  it('creates a household with the caller as owner, only once', async () => {
    const user = await createTestUser('Owner');
    const householdId = await createHousehold(user, 'Our place');
    const members = await user.client.from('household_members').select('*');
    expect(members.data).toEqual([
      expect.objectContaining({ household_id: householdId, user_id: user.id, role: 'owner' }),
    ]);
    const again = await user.client.rpc('create_household', { household_name: 'Second' });
    expectDbError(again, 'ALREADY_IN_HOUSEHOLD');
  });

  it('rejects an empty household name', async () => {
    const user = await createTestUser('Blank');
    const result = await user.client.rpc('create_household', { household_name: '   ' });
    expectDbError(result, /households_name_check/);
  });

  it('does not allow clients to insert memberships directly', async () => {
    const owner = await createTestUser('Direct');
    const householdId = await createHousehold(owner);
    const outsider = await createTestUser('Sneaky');
    const result = await outsider.client
      .from('household_members')
      .insert({ household_id: householdId, user_id: outsider.id, role: 'member' });
    expectDbError(result, /permission denied/);
  });
});

describe('invitations', () => {
  it('pairs two users through a single-use invitation', async () => {
    const { a, b, householdId } = await createPair();
    for (const user of [a, b]) {
      const members = await user.client.from('household_members').select('user_id, role');
      expect(members.data).toHaveLength(2);
      const profiles = await user.client
        .from('profiles')
        .select('display_name')
        .order('display_name');
      expect(profiles.data?.map((p) => p.display_name)).toEqual(['Asha', 'Bilal']);
      const household = await user.client.from('households').select('id').single();
      expect(household.data?.id).toBe(householdId);
    }
  });

  it('shows the invitee who invited them before accepting', async () => {
    const owner = await createTestUser('Inviter');
    await createHousehold(owner, 'Cozy flat');
    const token = await createInvitationToken(owner);
    const invitee = await createTestUser('Invitee');
    const preview = await invitee.client.rpc('preview_household_invitation', {
      invitation_token: token,
    });
    expect(preview.data).toEqual([
      expect.objectContaining({ household_name: 'Cozy flat', inviter_name: 'Inviter' }),
    ]);
    const bogus = await invitee.client.rpc('preview_household_invitation', {
      invitation_token: 'nope',
    });
    expect(bogus.data).toEqual([]);
  });

  it('rejects a reused token', async () => {
    const owner = await createTestUser('Reuse');
    await createHousehold(owner);
    const token = await createInvitationToken(owner);
    const first = await createTestUser('First');
    expect(
      (await first.client.rpc('accept_household_invitation', { invitation_token: token })).error,
    ).toBeNull();
    const second = await createTestUser('Second');
    const result = await second.client.rpc('accept_household_invitation', {
      invitation_token: token,
    });
    expectDbError(result, 'INVITE_INVALID');
  });

  it('rejects an expired token', async () => {
    const owner = await createTestUser('Expire');
    const householdId = await createHousehold(owner);
    const token = await createInvitationToken(owner);
    await withDb((db) =>
      db.query(
        "update public.household_invitations set expires_at = now() - interval '1 minute' where household_id = $1",
        [householdId],
      ),
    );
    const invitee = await createTestUser('Late');
    const result = await invitee.client.rpc('accept_household_invitation', {
      invitation_token: token,
    });
    expectDbError(result, 'INVITE_EXPIRED');
  });

  it('rejects a revoked token and keeps only the newest invitation live', async () => {
    const owner = await createTestUser('Revoke');
    await createHousehold(owner);
    const oldToken = await createInvitationToken(owner);
    const newToken = await createInvitationToken(owner);
    const invitee = await createTestUser('Joiner');
    const stale = await invitee.client.rpc('accept_household_invitation', {
      invitation_token: oldToken,
    });
    expectDbError(stale, 'INVITE_INVALID');

    const invitations = await owner.client
      .from('household_invitations')
      .select('id, revoked_at')
      .is('revoked_at', null);
    expect(invitations.data).toHaveLength(1);
    const liveId = invitations.data?.[0]?.id ?? '';
    expect(
      (await owner.client.rpc('revoke_household_invitation', { target_invitation_id: liveId }))
        .error,
    ).toBeNull();
    const revoked = await invitee.client.rpc('accept_household_invitation', {
      invitation_token: newToken,
    });
    expectDbError(revoked, 'INVITE_INVALID');
  });

  it('never exposes the token hash', async () => {
    const owner = await createTestUser('Hash');
    await createHousehold(owner);
    await createInvitationToken(owner);
    const result = await owner.client.from('household_invitations').select('token_hash');
    expectDbError(result, /permission denied/);
  });

  it('does not let a full household invite again', async () => {
    const { a } = await createPair();
    const result = await a.client.rpc('create_household_invitation');
    expectDbError(result, 'HOUSEHOLD_FULL');
  });

  it('lets only one of two concurrent invitees join', async () => {
    const owner = await createTestUser('Race');
    await createHousehold(owner);
    const token = await createInvitationToken(owner);
    const [x, y] = await Promise.all([createTestUser('RaceX'), createTestUser('RaceY')]);
    const results = await Promise.all(
      [x, y].map((user) =>
        user.client.rpc('accept_household_invitation', { invitation_token: token }),
      ),
    );
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    const members = await owner.client.from('household_members').select('user_id');
    expect(members.data).toHaveLength(2);
  });

  it('does not let someone already in a household join another', async () => {
    const owner = await createTestUser('HostA');
    await createHousehold(owner);
    const token = await createInvitationToken(owner);
    const busy = await createTestUser('Busy');
    await createHousehold(busy);
    const result = await busy.client.rpc('accept_household_invitation', {
      invitation_token: token,
    });
    expectDbError(result, 'ALREADY_IN_HOUSEHOLD');
  });
});

describe('outsiders', () => {
  it('cannot see the household, its members, profiles or invitations', async () => {
    const { a, householdId } = await createPair();
    const outsider = await createTestUser('Outsider');
    await createHousehold(outsider, 'Elsewhere');

    const households = await outsider.client.from('households').select('id').eq('id', householdId);
    expect(households.data).toEqual([]);
    const members = await outsider.client
      .from('household_members')
      .select('*')
      .eq('household_id', householdId);
    expect(members.data).toEqual([]);
    const profile = await outsider.client.from('profiles').select('*').eq('user_id', a.id);
    expect(profile.data).toEqual([]);
    const invitations = await outsider.client
      .from('household_invitations')
      .select('id')
      .eq('household_id', householdId);
    expect(invitations.data).toEqual([]);
  });

  it('cannot rename another household', async () => {
    const { a, householdId } = await createPair();
    const outsider = await createTestUser('Renamer');
    const result = await outsider.client
      .from('households')
      .update({ name: 'Mine now' })
      .eq('id', householdId)
      .select();
    expect(result.data).toEqual([]);
    const check = await a.client.from('households').select('name').single();
    expect(check.data?.name).toBe('Test home');
  });

  it('signed-out requests get nothing and cannot call RPCs', async () => {
    await createPair();
    const anon = anonClient();
    for (const table of ['profiles', 'households', 'household_members'] as const) {
      const result = await anon.from(table).select('*');
      expect(result.data ?? []).toEqual([]);
    }
    const rpc = await anon.rpc('create_household', { household_name: 'Anon' });
    expectDbError(rpc, /permission denied/);
  });
});
