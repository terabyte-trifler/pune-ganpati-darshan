'use client';

import { useEffect, useState } from 'react';
import { LocateFixed, LoaderCircle } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { TrackingSnapshot } from '@/services/visarjan-tracking';
import { MiniMap } from '@/features/map/MiniMapLoader';
import { MapFullscreen } from './MapFullscreen';
import type { Ganpati } from '@/types/ganpati';

/**
 * The visarjan map, with the reader on it.
 *
 * ---------------------------------------------------------------------
 * Why this map in particular wants a location.
 *
 * Every other mark here is a fact about the city: a road that shuts at
 * ten, a chowk the procession reaches at 12:35, a junction where you get
 * turned around. None of them answers the question actually being asked
 * on the day, which is "which of these is near ME". A dot on the map
 * turns a plan of the city into an answer about where the reader is
 * standing.
 *
 * Asked for, never taken. The browser prompts only when the button is
 * pressed, and the coordinate goes to a marker and nowhere else — not to
 * our server, not to storage, not into a URL. The rest of the app
 * treats location the same way; this is not a new bargain being struck
 * on a day when a lot of people are opening the site for the first time.
 *
 * ---------------------------------------------------------------------
 * The mandals on this map come from the police tracker.
 *
 * While their feed is current the map draws the fifteen they track, at
 * the positions they report, in their status colours — and the thirty
 * static pins stand down, because a tracked mandal's vehicle is a
 * kilometre from its mandap by mid-morning and drawing both would put
 * it in two places at once.
 *
 * When the feed goes stale the static pins come back. That is the
 * honest fallback: a mandap's location is always true, a position from
 * two hours ago is not.
 */
export function VisarjanMapControls({
  mandals,
  frameOn,
}: {
  mandals: Ganpati[];
  frameOn: { lat: number; lng: number }[];
}) {
  const { state, request } = useGeolocation();
  const [tracked, setTracked] = useState<TrackingSnapshot['mandals']>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/visarjan-tracking');
        if (!res.ok) return;
        const data = (await res.json()) as TrackingSnapshot;
        // Only while the positions are current; the service returns
        // nothing at all once they are not.
        if (alive) setTracked(data.ready ? data.mandals : []);
      } catch {
        // Leave the last good set up rather than blanking the map.
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const position = state.status === 'ready' ? state.position : null;
  const pending = state.status === 'locating';
  const denied = state.status === 'denied';

  return (
    <MapFullscreen className="mt-6 h-[380px] w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] sm:h-[460px]">
      <MiniMap
        mandals={mandals}
        showVisarjan
        showParking={false}
        showPedestrianFlow={false}
        uniformPins
        interactive
        userLocation={position}
        liveTracked={tracked}
        frameOn={frameOn}
        className="h-full w-full"
      />

      {/* Bottom-left: clear of the full-screen button above it and of
          MapLibre's zoom controls on the right. */}
      <button
        type="button"
        onClick={request}
        disabled={pending}
        aria-label={position ? 'Update your location on the map' : 'Show where you are on the map'}
        className={[
          'absolute bottom-3 left-3 z-10 inline-flex min-h-11 items-center gap-1.5',
          'rounded-[var(--radius-chip)] border px-3 text-[13px] font-semibold backdrop-blur',
          'bg-[var(--raat)]/90 text-[var(--chandan)]',
          position ? 'border-[#6fc47f]/60' : 'border-[var(--line-strong)]',
        ].join(' ')}
      >
        {pending ? (
          <LoaderCircle size={15} aria-hidden="true" className="animate-spin" />
        ) : (
          <LocateFixed
            size={15}
            aria-hidden="true"
            className={position ? 'text-[#6fc47f]' : undefined}
          />
        )}
        {pending ? 'Finding…' : position ? 'Found you' : 'Where am I?'}
      </button>

      {/* A refusal is the browser's to keep; the map simply carries on
          without the dot and says so once, quietly. */}
      {denied && (
        <p
          role="status"
          className="absolute bottom-16 left-3 z-10 max-w-[15rem] rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--raat)]/90 px-3 py-2 text-[12px] leading-relaxed text-[var(--muted)] backdrop-blur"
        >
          Location is off for this site. Everything else on the map still
          works — it just cannot show where you are.
        </p>
      )}
    </MapFullscreen>
  );
}
