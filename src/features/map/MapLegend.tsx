import { ExternalLink } from 'lucide-react';
import { PARKING, PARKING_SOURCE } from '@/content/parking';
import { ROAD_CLOSURES, CLOSURE_JUNCTIONS } from '@/content/diversions';
import {
  DRAWN_CLOSURES, DRAWN_DIVERSIONS, TOTAL_DIVERSIONS, PARKING_COUNT,
} from '@/lib/maps/visarjan-layer';

/**
 * What every symbol on a map in this app means.
 *
 * One component, two surfaces: the sheet behind the ⓘ on the full map,
 * and an always-visible block under the embedded map on /parking. Written
 * once because a key that disagrees with itself between two screens is
 * worse than no key — and because the counts are read from the data, so
 * they cannot drift from what is actually drawn.
 *
 * No hooks, so it renders on the server for /parking and inside the
 * client sheet on /map without either needing a copy.
 */

/**
 * How full the pin is says where the colour came from: filled is a
 * report, half is what phones nearby were seen doing, hollow is the app's
 * own estimate from the hour.
 *
 * The same convention the metro pins below already use on these maps, and
 * the same one the badges and the tracker rows use — so it only has to be
 * learned once.
 */
const CROWD = [
  { color: 'var(--crowd-short)', label: 'Short queue' },
  { color: 'var(--crowd-moving)', label: 'Moving' },
  { color: 'var(--crowd-long)', label: 'Heavy' },
  {
    color: 'var(--crowd-moving)',
    label: 'Half — observed, nobody has reported',
    half: true,
    wide: true,
  },
  {
    color: 'var(--crowd-moving)',
    label: 'Hollow — estimated from the hour of day',
    hollow: true,
    wide: true,
  },
  { color: 'var(--faint)', label: 'Grey — nothing to go on at all', wide: true },
];

export const PARKING_PIN = '#6C8AB0';
export const CLOSURE_INK = '#C8BCA8';

/** Matches lib/maps/pedestrian-flow-layer — open and moving, not shut. */
export const FLOW_INK = '#7FA8D8';
const METRO_PURPLE = '#8C6BB1';

export function MapLegend({
  /** The full map already links to itself; /parking does not need to. */
  showMapLink = false,
  /**
   * Visarjan day: the map below is drawing that day's plan, so the key
   * has to describe it. A key that still reads "closed after 17:00"
   * over lines that close from five in the morning is worse than no key
   * — it tells a reader the marks mean something they do not.
   */
  visarjan = false,
}: { showMapLink?: boolean; visarjan?: boolean }) {
  const captured = new Date(PARKING_SOURCE.captured).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <div>
      <p className="text-[13px] font-semibold text-[var(--chandan)]">
        Mandals — the pin colour is the queue
      </p>
      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {CROWD.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-2 text-[12px] text-[var(--muted)]${
              c.wide ? ' col-span-2' : ''
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full${
                c.hollow || c.half ? ' border-[1.5px]' : ''
              }`}
              style={
                c.hollow
                  ? { borderColor: c.color }
                  : c.half
                    ? {
                        borderColor: c.color,
                        background: `color-mix(in srgb, ${c.color} 30%, transparent)`,
                      }
                    : { background: c.color }
              }
            />
            {c.label}
          </li>
        ))}
      </ul>

      <p className="mt-3.5 text-[13px] font-semibold text-[var(--chandan)]">Metro</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: METRO_PURPLE }}
          />
          Station you can get off at
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px]"
            style={{ borderColor: METRO_PURPLE }}
          />
          Hollow — for the journey home; arrive at a filled station
        </li>
      </ul>

      <p className="mt-3.5 text-[13px] font-semibold text-[var(--chandan)]">
        Traffic Police plan
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[8px] font-bold text-[#0E1724]"
            style={{ background: PARKING_PIN }}
          >
            P
          </span>
          {visarjan
            ? `Parking — ${PARKING_COUNT} places the police name for today`
            : `Parking — ${PARKING.length} places`}
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-0 w-5 shrink-0 border-t-[2px] border-dashed"
            style={{ borderColor: CLOSURE_INK }}
          />
          {visarjan
            ? `Closed today — ${DRAWN_CLOSURES} stretches, each labelled with its hour`
            : `Closed after 17:00 — ${ROAD_CLOSURES.length} stretches`}
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px]"
            style={{ borderColor: CLOSURE_INK }}
          />
          {visarjan
            ? `Diversion point — ${DRAWN_DIVERSIONS} of ${TOTAL_DIVERSIONS} placed`
            : `Junction on the closure plan — ${CLOSURE_JUNCTIONS.length} of them`}
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          {/* A solid line with an arrowhead, because the direction is the
              whole content — the road is open, the crowd on it is not
              reversible. Nothing else on this legend is blue. */}
          <span
            aria-hidden="true"
            className="flex h-3.5 w-5 shrink-0 items-center text-[10px] font-bold leading-none"
            style={{ color: FLOW_INK }}
          >
            <span className="h-0 w-3.5 border-t-[2px]" style={{ borderColor: FLOW_INK }} />
            ›
          </span>
          One way on foot — arrows point the way to walk
        </li>
      </ul>

      <p className="prose-measure mt-3 border-t border-[var(--line)] pt-2.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
        Parking and closures are {PARKING_SOURCE.authority}&rsquo;s own plan,
        captured {captured}. A plan, not a live view — follow the barricades in
        front of you.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <a
          href={PARKING_SOURCE.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-[var(--shendur)]"
        >
          Open the police map
          <ExternalLink size={12} aria-hidden="true" />
        </a>
        <a
          href={showMapLink ? '/map' : '/parking'}
          className="inline-flex min-h-11 items-center text-[12.5px] font-semibold text-[var(--shendur)]"
        >
          {showMapLink ? 'Full map with search' : 'Parking & closures list'}
        </a>
      </div>
    </div>
  );
}
