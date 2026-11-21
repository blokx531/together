import type { PersonTone } from '@/shared/ui/Avatar';

export type Visibility = 'private' | 'household';

export interface ProfileRecord {
  userId: string;
  displayName: string;
  timeZone: string;
  defaultMealVisibility: Visibility;
}

export interface MembershipRecord {
  householdId: string;
  householdName: string;
  userId: string;
  role: 'owner' | 'member';
}

export interface Member {
  userId: string;
  displayName: string;
  role: 'owner' | 'member';
  tone: PersonTone;
}

export interface HouseholdView {
  householdId: string;
  householdName: string;
  me: Member;
  /** Null until the second person accepts an invitation. */
  partner: Member | null;
  timeZone: string;
  defaultMealVisibility: Visibility;
}

export type HouseholdViewResult =
  | { kind: 'ready'; view: HouseholdView }
  | { kind: 'no-household'; profile: ProfileRecord }
  | { kind: 'profile-missing' };

/**
 * Combines the caller's profile, visible profiles and memberships into the "me / partner" view
 * used across the app. Pure: RLS has already limited the input to the caller's household.
 */
export function buildHouseholdView(
  myUserId: string,
  profiles: readonly ProfileRecord[],
  memberships: readonly MembershipRecord[],
): HouseholdViewResult {
  const myProfile = profiles.find((p) => p.userId === myUserId);
  if (!myProfile) return { kind: 'profile-missing' };
  const myMembership = memberships.find((m) => m.userId === myUserId);
  if (!myMembership) return { kind: 'no-household', profile: myProfile };

  const partnerMembership = memberships.find(
    (m) => m.userId !== myUserId && m.householdId === myMembership.householdId,
  );
  const partnerProfile = partnerMembership
    ? profiles.find((p) => p.userId === partnerMembership.userId)
    : undefined;

  return {
    kind: 'ready',
    view: {
      householdId: myMembership.householdId,
      householdName: myMembership.householdName,
      me: {
        userId: myUserId,
        displayName: myProfile.displayName,
        role: myMembership.role,
        tone: 'me',
      },
      partner:
        partnerMembership && partnerProfile
          ? {
              userId: partnerMembership.userId,
              displayName: partnerProfile.displayName,
              role: partnerMembership.role,
              tone: 'partner',
            }
          : null,
      timeZone: myProfile.timeZone,
      defaultMealVisibility: myProfile.defaultMealVisibility,
    },
  };
}

/** Display name for any member id, falling back safely for removed accounts. */
export function memberName(view: HouseholdView, userId: string): string {
  if (userId === view.me.userId) return view.me.displayName;
  const partner = view.partner;
  if (partner?.userId === userId) return partner.displayName;
  return 'Former member';
}
