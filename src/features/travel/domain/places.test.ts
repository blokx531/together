import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/lib/localDate';
import { parsePhotonResponse } from '../data/placeSearch';
import {
  countryOptions,
  filterPlaces,
  flagEmoji,
  markerKind,
  parseCoordinates,
  summarizeVisits,
  travelStats,
  type Place,
} from './places';

const ME = 'me';
const PARTNER = 'partner';
const people = { meId: ME, partnerId: PARTNER };

function place(name: string, visitors: string[][], overrides: Partial<Place> = {}): Place {
  return {
    id: name,
    createdBy: ME,
    visibility: 'household',
    name,
    locality: null,
    region: null,
    countryCode: 'IN',
    countryName: 'India',
    latitude: 0,
    longitude: 0,
    isWishlist: false,
    note: null,
    visits: visitors.map((memberIds, index) => ({
      id: `${name}-${index}`,
      startedOn: '2025-01-01' as LocalDate,
      endedOn: null,
      note: null,
      memberIds,
    })),
    ...overrides,
  };
}

const goa = place('Goa', [[ME, PARTNER]]);
const pune = place('Pune', [[ME]]);
const delhi = place('Delhi', [[PARTNER]]);
const kyoto = place('Kyoto', [], { isWishlist: true, countryCode: 'JP' });
const split = place('Split trip', [[ME], [PARTNER]]);

describe('visit classification', () => {
  it('marks a place "together" only when both are on the same visit', () => {
    expect(summarizeVisits(goa, people)).toEqual({
      isVisited: true,
      byMe: true,
      byPartner: true,
      together: true,
    });
    expect(summarizeVisits(split, people).together).toBe(false);
    expect(markerKind(split, people)).toBe('mine');
    expect(markerKind(kyoto, people)).toBe('wishlist');
  });

  it('filters Mine / Partner / Together / Wishlist', () => {
    const all = [goa, pune, delhi, kyoto, split];
    expect(filterPlaces(all, 'mine', people).map((p) => p.name)).toEqual([
      'Goa',
      'Pune',
      'Split trip',
    ]);
    expect(filterPlaces(all, 'partner', people).map((p) => p.name)).toEqual([
      'Goa',
      'Delhi',
      'Split trip',
    ]);
    expect(filterPlaces(all, 'together', people).map((p) => p.name)).toEqual(['Goa']);
    expect(filterPlaces(all, 'wishlist', people).map((p) => p.name)).toEqual(['Kyoto']);
  });

  it('counts visited and wishlist separately', () => {
    expect(travelStats([goa, pune, kyoto])).toEqual({
      placesVisited: 2,
      countriesVisited: 1,
      wishlist: 1,
    });
  });

  it('works before a partner joins', () => {
    expect(summarizeVisits(pune, { meId: ME, partnerId: null })).toMatchObject({
      byPartner: false,
      together: false,
    });
  });
});

describe('parseCoordinates', () => {
  it.each([
    ['26.9124, 75.7873', { latitude: 26.9124, longitude: 75.7873 }],
    ['-33.86 151.21', { latitude: -33.86, longitude: 151.21 }],
  ])('parses %s', (input, expected) => {
    expect(parseCoordinates(input)).toEqual(expected);
  });
  it.each(['95, 10', '10, 190', 'Jaipur', ''])('rejects %s', (input) => {
    expect(parseCoordinates(input)).toBeNull();
  });
});

describe('flagEmoji', () => {
  it('turns country codes into flags', () => {
    expect(flagEmoji('IN')).toBe('🇮🇳');
    expect(flagEmoji(null)).toBe('📍');
  });
});

describe('parsePhotonResponse', () => {
  it('maps valid features and skips malformed ones', () => {
    const result = parsePhotonResponse({
      features: [
        {
          geometry: { coordinates: [75.7873, 26.9124] },
          properties: {
            name: 'Jaipur',
            state: 'Rajasthan',
            country: 'India',
            countrycode: 'in',
            osm_type: 'R',
            osm_id: 1950641,
          },
        },
        { geometry: { coordinates: ['x', 1] }, properties: { name: 'Broken' } },
        { geometry: { coordinates: [10, 95] }, properties: { name: 'Out of range' } },
      ],
    });
    expect(result).toEqual([
      {
        name: 'Jaipur',
        locality: null,
        region: 'Rajasthan',
        countryCode: 'IN',
        countryName: 'India',
        latitude: 26.9124,
        longitude: 75.7873,
        sourceRef: 'R1950641',
      },
    ]);
  });

  it('rejects a response that is not GeoJSON', () => {
    expect(() => parsePhotonResponse({ error: 'rate limited' })).toThrow();
  });
});

describe('countryOptions', () => {
  it('lists named ISO regions including India, without macro-regions', () => {
    const options = countryOptions();
    expect(options).toContainEqual({ code: 'IN', name: 'India' });
    expect(options.find((o) => o.code === 'EU')).toBeUndefined();
    expect(options.length).toBeGreaterThan(200);
  });
});
