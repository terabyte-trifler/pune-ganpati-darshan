'use client';

import { useCallback, useState } from 'react';
import type { LatLng } from '@/lib/geo';

/**
 * Geolocation, requested only when the user asks for it.
 *
 * Deliberately NOT a `useEffect` that fires on mount: a permission prompt
 * on page load is hostile, and the brief forbids it (§14). The position is
 * fetched once per explicit request rather than watched, which also avoids
 * draining the battery of someone walking around Pune all evening (§46).
 */

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; position: LatLng; accuracyM: number }
  | { status: 'denied' }
  | { status: 'unavailable' };

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' });

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'unavailable' });
      return;
    }

    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: 'ready',
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracyM: pos.coords.accuracy,
        }),
      (error) =>
        setState(
          error.code === error.PERMISSION_DENIED
            ? { status: 'denied' }
            : { status: 'unavailable' }
        ),
      {
        enableHighAccuracy: true,
        // A stale-but-recent fix is fine and much faster outdoors.
        maximumAge: 60_000,
        timeout: 10_000,
      }
    );
  }, []);

  return { state, request };
}
