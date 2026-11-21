import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Point } from 'geojson';
import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { markerKind, type People, type Place } from '../domain/places';

/**
 * Interactive map of saved places, loaded only on the World page (MapLibre is large).
 * Tiles come from OpenFreeMap by default (keyless, no SLA); override with VITE_MAP_STYLE_URL.
 * If WebGL or the tiles are unavailable the page still shows the place list.
 */
const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_URL: string =
  typeof import.meta.env.VITE_MAP_STYLE_URL === 'string' &&
  import.meta.env.VITE_MAP_STYLE_URL !== ''
    ? import.meta.env.VITE_MAP_STYLE_URL
    : DEFAULT_STYLE_URL;
const LOAD_TIMEOUT_MS = 12_000;
const INDIA_CENTER: [number, number] = [78.9, 22.5];
const SOURCE_ID = 'places';

// MapLibre paint needs concrete colours; these mirror the design tokens (accent, me, partner, muted).
export const MARKER_COLORS = {
  together: '#1f6f63',
  mine: '#4a55c2',
  partner: '#c9663d',
  wishlist: '#8c8a85',
} as const;

function supportsWebGl(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

function toGeoJson(places: readonly Place[], people: People): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: places.map((place) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] },
      properties: { id: place.id, kind: markerKind(place, people), name: place.name },
    })),
  };
}

interface TravelMapProps {
  places: readonly Place[];
  people: People;
  onSelect: (placeId: string) => void;
}

export function TravelMap({ places, people, onSelect }: TravelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(() =>
    supportsWebGl() ? 'loading' : 'failed',
  );
  const select = useEffectEvent(onSelect);
  const currentData = useEffectEvent(() => toGeoJson(places, people));

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !supportsWebGl()) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: STYLE_URL,
        center: INDIA_CENTER,
        zoom: 3,
        attributionControl: { compact: true },
      });
    } catch (error) {
      // MapLibre (an external system) failed to start; report it outside the effect body.
      console.warn('Map could not start', error);
      queueMicrotask(() => {
        setStatus('failed');
      });
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    const timeout = window.setTimeout(() => {
      if (!map.loaded()) setStatus('failed');
    }, LOAD_TIMEOUT_MS);

    map.on('load', () => {
      window.clearTimeout(timeout);
      map.addSource(SOURCE_ID, { type: 'geojson', data: currentData() });
      map.addLayer({
        id: 'places-circles',
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match',
            ['get', 'kind'],
            'together',
            MARKER_COLORS.together,
            'mine',
            MARKER_COLORS.mine,
            'partner',
            MARKER_COLORS.partner,
            '#ffffff',
          ],
          'circle-stroke-color': [
            'match',
            ['get', 'kind'],
            'wishlist',
            MARKER_COLORS.wishlist,
            '#ffffff',
          ],
          'circle-stroke-width': ['match', ['get', 'kind'], 'wishlist', 2.5, 2],
        },
      });
      map.on('click', 'places-circles', (event: MapLayerMouseEvent) => {
        const id: unknown = event.features?.[0]?.properties.id;
        if (typeof id === 'string') select(id);
      });
      map.on('mouseenter', 'places-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'places-circles', () => {
        map.getCanvas().style.cursor = '';
      });
      setStatus('ready');
    });
    return () => {
      window.clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    const source = map.getSource<GeoJSONSource>(SOURCE_ID);
    source?.setData(toGeoJson(places, people)).catch((error: unknown) => {
      console.warn('Map update failed', error);
    });
    if (places.length > 0) {
      const bounds = new LngLatBounds();
      for (const place of places) bounds.extend([place.longitude, place.latitude]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 8, duration: 0 });
    }
  }, [places, people, status]);

  return (
    <div className="relative h-72 overflow-hidden rounded-card border border-line bg-surface-2 sm:h-96">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="Map of saved places"
        role="region"
      />
      {status === 'failed' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2 p-6 text-center text-sm text-ink-muted">
          The map could not load (no connection to the map service, or WebGL is unavailable). Your
          places are listed below.
        </div>
      ) : null}
      {status === 'loading' ? (
        <div className="absolute inset-x-0 bottom-2 text-center text-xs text-ink-muted">
          Loading map…
        </div>
      ) : null}
    </div>
  );
}
