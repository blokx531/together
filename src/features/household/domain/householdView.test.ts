import { describe, expect, it } from 'vitest';
import {
  buildHouseholdView,
  memberName,
  type MembershipRecord,
  type ProfileRecord,
} from './householdView';

const profile = (userId: string, displayName: string): ProfileRecord => ({
  userId,
  displayName,
  timeZone: 'Asia/Kolkata',
  defaultMealVisibility: 'household',
});
const membership = (userId: string, role: 'owner' | 'member'): MembershipRecord => ({
  householdId: 'h1',
  householdName: 'Home',
  userId,
  role,
});

describe('buildHouseholdView', () => {
  it('reports a missing profile', () => {
    expect(buildHouseholdView('a', [], []).kind).toBe('profile-missing');
  });

  it('reports a user without a household', () => {
    expect(buildHouseholdView('a', [profile('a', 'Asha')], []).kind).toBe('no-household');
  });

  it('builds a solo household before the partner joins', () => {
    const result = buildHouseholdView('a', [profile('a', 'Asha')], [membership('a', 'owner')]);
    expect(result.kind === 'ready' && result.view.partner).toBeNull();
  });

  it('assigns me/partner tones from the viewer perspective', () => {
    const profiles = [profile('a', 'Asha'), profile('b', 'Bilal')];
    const memberships = [membership('a', 'owner'), membership('b', 'member')];
    const fromB = buildHouseholdView('b', profiles, memberships);
    if (fromB.kind !== 'ready') throw new Error('expected ready');
    expect(fromB.view.me).toMatchObject({ userId: 'b', displayName: 'Bilal', tone: 'me' });
    expect(fromB.view.partner).toMatchObject({ userId: 'a', displayName: 'Asha', tone: 'partner' });
    expect(memberName(fromB.view, 'a')).toBe('Asha');
    expect(memberName(fromB.view, 'zzz')).toBe('Former member');
  });
});
