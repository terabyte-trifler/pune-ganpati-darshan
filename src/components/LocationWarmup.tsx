'use client';

import { useResolveLocation } from '@/hooks/useGeolocation';

/**
 * Start locating on app load, not when a screen finally needs it.
 *
 * Nothing asked the device where it was until somebody opened the planner,
 * the wizard or the report controls — so the wait for a fix began at the
 * moment it was already needed. Measured on a production build at 4x CPU
 * throttle, opening the homepage, pausing, then opening a two-wheeler
 * plan: the ride card arrived 4733 ms after the planner when the device
 * answered in four seconds, and 866 ms when it answered in three hundred
 * milliseconds. Almost all of that was acquisition that could have been
 * running while the visitor read the homepage.
 *
 * This asks NOBODY for permission. useResolveLocation queries the
 * Permissions API first and only calls getCurrentPosition where the
 * answer is already 'granted'; 'prompt' is left for a screen that can
 * explain why it is asking, which is the rule the architecture notes set
 * and this does not relax. Somebody who has never granted it sees no
 * difference, and no dialogue appears on load.
 *
 * Renders nothing. It exists to be mounted by the root layout.
 */
export function LocationWarmup() {
  useResolveLocation();
  return null;
}
