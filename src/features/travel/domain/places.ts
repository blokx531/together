import type { LocalDate } from '@/shared/lib/localDate';

export interface Visit {
  id: string;
  startedOn: LocalDate;
  endedOn: LocalDate | null;
  note: string | null;
  memberIds: string[];
}

export interface Place {
  id: string;
  createdBy: string;
  visibility: 'private' | 'household';
  name: string;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  countryName: string | null;
  latitude: number;
  longitude: number;
  isWishlist: boolean;
  note: string | null;
  visits: Visit[];
}

export type PlaceFilter = 'all' | 'mine' | 'partner' | 'together' | 'wishlist';

export interface People {
  meId: string;
  partnerId: string | null;
}

/** Who has been to a place, derived only from recorded visits (a wish is never a visit). */
export interface VisitSummary {
  isVisited: boolean;
  byMe: boolean;
  byPartner: boolean;
  /** At least one visit with both people recorded. */
  together: boolean;
}

export function summarizeVisits(place: Place, people: People): VisitSummary {
  const byMe = place.visits.some((visit) => visit.memberIds.includes(people.meId));
  const byPartner =
    people.partnerId !== null &&
    place.visits.some((visit) => visit.memberIds.includes(people.partnerId ?? ''));
  const together =
    people.partnerId !== null &&
    place.visits.some(
      (visit) =>
        visit.memberIds.includes(people.meId) && visit.memberIds.includes(people.partnerId ?? ''),
    );
  return { isVisited: place.visits.length > 0, byMe, byPartner, together };
}

export function filterPlaces(
  places: readonly Place[],
  filter: PlaceFilter,
  people: People,
): Place[] {
  return places.filter((place) => {
    const summary = summarizeVisits(place, people);
    switch (filter) {
      case 'all':
        return true;
      case 'mine':
        return summary.byMe;
      case 'partner':
        return summary.byPartner;
      case 'together':
        return summary.together;
      case 'wishlist':
        return place.isWishlist;
    }
  });
}

export type MarkerKind = 'together' | 'mine' | 'partner' | 'wishlist';

/** Map colour category: together beats individual visits; unvisited wishes are their own layer. */
export function markerKind(place: Place, people: People): MarkerKind {
  const summary = summarizeVisits(place, people);
  if (summary.together) return 'together';
  if (summary.byMe) return 'mine';
  if (summary.byPartner) return 'partner';
  return 'wishlist';
}

export interface TravelStats {
  placesVisited: number;
  countriesVisited: number;
  wishlist: number;
}

/** Counts for a set of places. Countries count only places with a country code and a visit. */
export function travelStats(places: readonly Place[]): TravelStats {
  const visited = places.filter((place) => place.visits.length > 0);
  return {
    placesVisited: visited.length,
    countriesVisited: new Set(
      visited.map((place) => place.countryCode).filter((code) => code !== null),
    ).size,
    wishlist: places.filter((place) => place.isWishlist).length,
  };
}

/** Parses "26.9124, 75.7873" (as copied from most map apps) into coordinates. */
export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  const match = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(input);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** Unicode regional-indicator flag for an ISO 3166-1 alpha-2 code ("IN" → 🇮🇳). */
export function flagEmoji(countryCode: string | null): string {
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return '📍';
  const REGIONAL_INDICATOR_A = 0x1f1e6;
  return String.fromCodePoint(
    REGIONAL_INDICATOR_A + countryCode.charCodeAt(0) - 65,
    REGIONAL_INDICATOR_A + countryCode.charCodeAt(1) - 65,
  );
}

export interface CountryOption {
  code: string;
  name: string;
}

/**
 * ISO 3166-1 alpha-2 regions known to the browser's Intl data, sorted by English name. Built by
 * probing every two-letter code, so no country list has to be shipped or maintained.
 */
export function countryOptions(locale = 'en'): CountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' });
  const options: CountryOption[] = [];
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const name = names.of(code);
      // Exclude reserved/private-use codes the browser does not name, and macro-regions like "EU".
      if (name && name !== code && !['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ'].includes(code))
        options.push({ code, name });
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, locale));
}
