'use client';

import { useEffect, useRef } from 'react';
import {
  useGeolocation, useResolveLocation, requestPreciseLocation,
} from '@/hooks/useGeolocation';
import type { LatLng } from '@/lib/geo';
import { reportEligibility, type ReportEligibility } from './report-eligibility';

/**
 * The location gate, in one place.
 *
 * Both things a person can report — the colour of a queue and how long
 * they stood in it — are only worth having from somebody who was at the
 * mandal. Those two controls live in different components on three
 * different surfaces, so the rule is held here rather than in each of
 * them: a gate that has been copied is a gate that will eventually
 * disagree with itself about who is close enough.
 *
 * Geolocation itself is a module-level store, so every caller of this
 * shares one fix and one `watchPosition`. Mounting the colour buttons and
 * the wait buckets on the same page costs one GPS request, not two.
 */
export function useReportGate(location: LatLng | undefined): {
  eligibility: ReportEligibility;
  /** True only on a precise fix inside AT_MANDAL_RADIUS_M. Client-asserted. */
  atMandal: boolean;
  /** Opens the permission dialog. Never called without a tap. */
  requestLocation: () => void;
} {
  const { state: geo, request: requestLocation } = useGeolocation();
  // Picks up a permission already granted; never opens a dialog by itself.
  useResolveLocation();

  const eligibility = reportEligibility(geo, location);

  /**
   * A coarse fix that lands outside the radius asks the GPS radio once.
   *
   * Acquisition prefers a coarse fix because it is fast, and at the old
   * 5 km gate that cost nothing. At 1 km it can put somebody standing at
   * the mandal outside the radius, so rather than refuse them, this
   * escalates — once per mount, guarded by a ref, because a
   * `watchPosition` that keeps landing coarse must not turn into a loop
   * of radio requests.
   */
  const refined = useRef(false);
  useEffect(() => {
    if (eligibility.kind !== 'refining' || refined.current) return;
    refined.current = true;
    requestPreciseLocation();
  }, [eligibility.kind]);

  return {
    eligibility,
    atMandal: eligibility.kind === 'allowed' && eligibility.atMandal,
    requestLocation,
  };
}
