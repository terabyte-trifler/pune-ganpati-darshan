'use client';

import { useLiveRouteTime } from '@/features/crowd/useLiveRouteTime';
import { formatDuration } from '@/lib/geo';
import type { Ganpati } from '@/types/ganpati';

/**
 * The "in total" figure on a curated route page.
 *
 * A client island inside an otherwise prerendered stat row, so the page
 * keeps its static HTML — and its SEO — while the one number that genuinely
 * changes through the evening is allowed to change. It renders the
 * published estimate on the server and during hydration, then corrects
 * itself only if the tracker has something to say.
 */
export function RouteTotalStat({
  mandals,
  darshanS,
  travelS,
}: {
  mandals: Ganpati[];
  darshanS: number;
  travelS: number;
}) {
  const live = useLiveRouteTime(mandals, darshanS);
  return <>{formatDuration(live.darshanS + travelS)}</>;
}
