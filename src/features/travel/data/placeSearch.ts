import * as z from 'zod/mini';
import { AppError, toAppError } from '@/shared/lib/appError';

/**
 * Place search via the public Photon instance (komoot), which allows search-as-you-type under fair
 * use. Results are suggestions only: the chosen label and coordinates are saved with the place, so
 * nothing depends on Photon afterwards. Callers debounce input and require ≥ 3 characters.
 */
const PHOTON_URL = 'https://photon.komoot.io/api/';
export const MIN_SEARCH_LENGTH = 3;
const RESULT_LIMIT = 6;
const TIMEOUT_MS = 8_000;

export interface PlaceSuggestion {
  name: string;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  countryName: string | null;
  latitude: number;
  longitude: number;
  sourceRef: string | null;
}

const photonFeature = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    name: z.optional(z.string()),
    city: z.optional(z.string()),
    state: z.optional(z.string()),
    country: z.optional(z.string()),
    countrycode: z.optional(z.string()),
    osm_type: z.optional(z.string()),
    osm_id: z.optional(z.number()),
  }),
});
const photonResponse = z.object({ features: z.array(z.unknown()) });

/** Validates Photon's GeoJSON. Malformed features are skipped rather than trusted. */
export function parsePhotonResponse(raw: unknown): PlaceSuggestion[] {
  const response = photonResponse.safeParse(raw);
  if (!response.success)
    throw new AppError('unknown', 'Place search returned an unexpected response.');
  const suggestions: PlaceSuggestion[] = [];
  for (const item of response.data.features) {
    const feature = photonFeature.safeParse(item);
    if (!feature.success) continue;
    const [longitude, latitude] = feature.data.geometry.coordinates;
    const props = feature.data.properties;
    const name = props.name ?? props.city;
    if (!name || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const code = props.countrycode?.toUpperCase() ?? null;
    suggestions.push({
      name,
      locality: props.city && props.city !== name ? props.city : null,
      region: props.state ?? null,
      countryCode: code && /^[A-Z]{2}$/.test(code) ? code : null,
      countryName: props.country ?? null,
      latitude,
      longitude,
      sourceRef:
        props.osm_type && props.osm_id !== undefined ? `${props.osm_type}${props.osm_id}` : null,
    });
  }
  return suggestions;
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SEARCH_LENGTH) return [];
  const url = `${PHOTON_URL}?${new URLSearchParams({ q: trimmed, limit: String(RESULT_LIMIT), lang: 'en' }).toString()}`;
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: AbortSignal.any([signal, timeout]) });
    if (response.status === 429)
      throw new AppError(
        'network',
        'Place search is busy right now. Try again shortly, or enter coordinates.',
      );
    if (!response.ok)
      throw new AppError(
        'network',
        'Place search is unavailable. You can enter coordinates instead.',
      );
    return parsePhotonResponse(await response.json());
  } catch (error) {
    if (timeout.aborted)
      throw new AppError('network', 'Place search timed out. You can enter coordinates instead.');
    throw toAppError(error);
  }
}
