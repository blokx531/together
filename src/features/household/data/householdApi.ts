import { toAppError } from '@/shared/lib/appError';
import { getSupabase } from '@/shared/lib/supabase';
import type { MembershipRecord, ProfileRecord, Visibility } from '../domain/householdView';

function asVisibility(value: string): Visibility {
  return value === 'private' ? 'private' : 'household';
}

function asRole(value: string): 'owner' | 'member' {
  return value === 'owner' ? 'owner' : 'member';
}

export interface HouseholdSnapshot {
  profiles: ProfileRecord[];
  memberships: MembershipRecord[];
}

/** RLS returns only the caller's own rows and their partner's, so no filters are needed. */
export async function loadHouseholdSnapshot(signal: AbortSignal): Promise<HouseholdSnapshot> {
  const db = getSupabase();
  const [profiles, members] = await Promise.all([
    db
      .from('profiles')
      .select('user_id, display_name, time_zone, default_meal_visibility')
      .abortSignal(signal),
    db
      .from('household_members')
      .select('household_id, user_id, role, households(name)')
      .abortSignal(signal),
  ]);
  if (profiles.error) throw toAppError(profiles.error);
  if (members.error) throw toAppError(members.error);
  return {
    profiles: profiles.data.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      timeZone: row.time_zone,
      defaultMealVisibility: asVisibility(row.default_meal_visibility),
    })),
    memberships: members.data.map((row) => ({
      householdId: row.household_id,
      householdName: row.households.name,
      userId: row.user_id,
      role: asRole(row.role),
    })),
  };
}

export async function createHousehold(name: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_household', { household_name: name });
  if (error) throw toAppError(error);
  return data;
}

export interface CreatedInvitation {
  token: string;
  expiresAt: string;
}

export async function createInvitation(): Promise<CreatedInvitation> {
  const { data, error } = await getSupabase().rpc('create_household_invitation').single();
  if (error) throw toAppError(error);
  return { token: data.token, expiresAt: data.expires_at };
}

export interface InvitationPreview {
  householdName: string;
  inviterName: string;
  expiresAt: string;
}

/** Null when the token is unknown, used, revoked or expired. */
export async function previewInvitation(
  token: string,
  signal: AbortSignal,
): Promise<InvitationPreview | null> {
  const { data, error } = await getSupabase()
    .rpc('preview_household_invitation', { invitation_token: token })
    .abortSignal(signal);
  if (error) throw toAppError(error);
  const row = data[0];
  return row
    ? {
        householdName: row.household_name,
        inviterName: row.inviter_name,
        expiresAt: row.expires_at,
      }
    : null;
}

export async function acceptInvitation(token: string): Promise<void> {
  const { error } = await getSupabase().rpc('accept_household_invitation', {
    invitation_token: token,
  });
  if (error) throw toAppError(error);
}

export interface ProfileUpdate {
  displayName: string;
  timeZone: string;
  defaultMealVisibility: Visibility;
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      display_name: update.displayName,
      time_zone: update.timeZone,
      default_meal_visibility: update.defaultMealVisibility,
    })
    .eq('user_id', userId);
  if (error) throw toAppError(error);
}

export async function renameHousehold(householdId: string, name: string): Promise<void> {
  const { error } = await getSupabase().from('households').update({ name }).eq('id', householdId);
  if (error) throw toAppError(error);
}
