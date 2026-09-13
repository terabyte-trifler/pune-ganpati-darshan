import { ExternalLink } from 'lucide-react';
import { PARKING, PARKING_SOURCE } from '@/content/parking';
import { ROAD_CLOSURES, CLOSURE_JUNCTIONS } from '@/content/diversions';

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

const CROWD = [
  { color: 'var(--crowd-short)', label: 'Short queue' },
  { color: 'var(--crowd-moving)', label: 'Moving' },
  { color: 'var(--crowd-long)', label: 'Heavy' },
  { color: 'var(--faint)', label: 'Not reported yet' },
];

export const PARKING_PIN = '#6C8AB0';
export const CLOSURE_INK = '#C8BCA8';
const METRO_PURPLE = '#8C6BB1';

export function MapLegend({
  /** The full map already links to itself; /parking does not need to. */
  showMapLink = false,
}: { showMapLink?: boolean }) {
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
          <li key={c.label} className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: c.color }}
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
          Hollow — boarding only, marked &ldquo;exit only&rdquo;
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
          Parking — {PARKING.length} places
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-0 w-5 shrink-0 border-t-[2px] border-dashed"
            style={{ borderColor: CLOSURE_INK }}
          />
          Closed after 17:00 — {ROAD_CLOSURES.length} stretches
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px]"
            style={{ borderColor: CLOSURE_INK }}
          />
          Junction on the closure plan — {CLOSURE_JUNCTIONS.length} of them
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
