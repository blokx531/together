import { toAppError } from '@/shared/lib/appError';
import { parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { getSupabase } from '@/shared/lib/supabase';
import type { Place } from '../domain/places';

const MAX_PLACES = 1000;

function requireDate(value: string): LocalDate {
  const date = parseLocalDate(value);
  if (!date) throw new Error(`Unexpected date: ${value}`);
  return date;
}

export async function listPlaces(signal: AbortSignal): Promise<Place[]> {
  const { data, error } = await getSupabase()
    .from('places')
    .select('*, visits(id, started_on, ended_on, note, visit_members(user_id))')
    .order('created_at', { ascending: false })
    .limit(MAX_PLACES)
    .abortSignal(signal);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    createdBy: row.created_by,
    visibility: row.visibility === 'private' ? 'private' : 'household',
    name: row.name,
    locality: row.locality,
    region: row.region,
    countryCode: row.country_code,
    countryName: row.country_name,
    latitude: row.latitude,
    longitude: row.longitude,
    isWishlist: row.is_wishlist,
    note: row.note,
    visits: row.visits
      .map((visit) => ({
        id: visit.id,
        startedOn: requireDate(visit.started_on),
        endedOn: visit.ended_on ? requireDate(visit.ended_on) : null,
        note: visit.note,
        memberIds: visit.visit_members.map((member) => member.user_id),
      }))
      .sort((a, b) => (a.startedOn < b.startedOn ? 1 : -1)),
  }));
}

export interface NewPlace {
  requestId: string;
  name: string;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  countryName: string | null;
  latitude: number;
  longitude: number;
  source: 'manual' | 'photon';
  sourceRef: string | null;
  visibility: 'private' | 'household';
  isWishlist: boolean;
  firstVisit: { startedOn: LocalDate; endedOn: LocalDate | null; memberIds: string[] } | null;
}

export async function createPlace(input: NewPlace): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_place', {
    p_client_request_id: input.requestId,
    p_name: input.name,
    p_locality: input.locality ?? '',
    p_region: input.region ?? '',
    p_country_code: input.countryCode ?? '',
    p_country_name: input.countryName ?? '',
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_source: input.source,
    p_source_ref: input.sourceRef ?? '',
    p_visibility: input.visibility,
    p_is_wishlist: input.isWishlist,
    ...(input.firstVisit
      ? {
          p_visit_started_on: input.firstVisit.startedOn,
          ...(input.firstVisit.endedOn ? { p_visit_ended_on: input.firstVisit.endedOn } : {}),
          p_visit_member_ids: input.firstVisit.memberIds,
        }
      : {}),
  });
  if (error) throw toAppError(error);
  return data;
}

export interface NewVisit {
  requestId: string;
  placeId: string;
  startedOn: LocalDate;
  endedOn: LocalDate | null;
  note: string;
  memberIds: string[];
}

export async function addVisit(input: NewVisit): Promise<void> {
  const { error } = await getSupabase().rpc('add_visit', {
    p_client_request_id: input.requestId,
    p_place_id: input.placeId,
    p_started_on: input.startedOn,
    p_member_ids: input.memberIds,
    p_note: input.note,
    ...(input.endedOn ? { p_ended_on: input.endedOn } : {}),
  });
  if (error) throw toAppError(error);
}

export async function setWishlist(placeId: string, isWishlist: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('places')
    .update({ is_wishlist: isWishlist })
    .eq('id', placeId);
  if (error) throw toAppError(error);
}

export async function deletePlace(placeId: string): Promise<void> {
  const { error } = await getSupabase().from('places').delete().eq('id', placeId);
  if (error) throw toAppError(error);
}

export async function deleteVisit(visitId: string): Promise<void> {
  const { error } = await getSupabase().from('visits').delete().eq('id', visitId);
  if (error) throw toAppError(error);
}
