'use client';

import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { env, features } from '@/lib/env';

/**
 * Single point of entry for the Maps JS SDK.
 *
 * - Loaded lazily: nothing is fetched until a surface actually asks for a
 *   map, so pages without one ship no Maps JS at all (§33).
 * - Concurrent callers share one in-flight promise.
 * - Returns a typed failure instead of throwing, so callers can render the
 *   "map unavailable" state rather than crashing the page (§36).
 */

export type MapsLoadResult =
  | { ok: true }
  | { ok: false; reason: 'no-api-key' | 'load-failed' };

let configured = false;
let pending: Promise<MapsLoadResult> | null = null;

export function isMapsConfigured() {
  return features.maps;
}

function configure() {
  if (configured) return;
  setOptions({
    key: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    v: 'weekly',
    language: 'en',
    region: 'IN',
  });
  configured = true;
}

export async function loadMaps(): Promise<MapsLoadResult> {
  if (!features.maps) return { ok: false, reason: 'no-api-key' };
  if (pending) return pending;

  configure();

  pending = (async () => {
    try {
      // `marker` is required for AdvancedMarkerElement.
      await Promise.all([importLibrary('maps'), importLibrary('marker')]);
      return { ok: true } as const;
    } catch (error) {
      // Reset so a retry after reconnecting can succeed.
      pending = null;
      console.error('Google Maps failed to load', error);
      return { ok: false, reason: 'load-failed' } as const;
    }
  })();

  return pending;
}

/** Places library, needed only by the search surface. */
export async function loadPlacesLibrary() {
  if (!features.maps) return null;
  configure();
  try {
    return await importLibrary('places');
  } catch (error) {
    console.error('Google Places failed to load', error);
    return null;
  }
}
