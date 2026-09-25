import { PROCESSION_ROUTE } from '@/content/visarjan';
import { OSM_CREDIT } from '@/content/visarjan-geometry';
import {
  DRAWN_CLOSURES, TOTAL_CLOSURES, ALL_CHECKPOINTS, PARKING_COUNT, POLICE_SOURCE,
} from '@/lib/maps/visarjan-layer';

/**
 * The key to the visarjan map, and the provenance under it.
 *
 * Shared because the map is. /map and /visarjan render the same
 * component, so a key that lived on one page would have left the other
 * showing eight kinds of mark with nothing to say what any of them
 * meant — and a second copy would have drifted the first time a colour
 * changed, which has happened four times in a night.
 *
 * The counts are read from the layer rather than written here, so the
 * key cannot claim more closures than are drawn.
 */
export function VisarjanMapKey({ mandalCount }: { mandalCount: number }) {
  return (
      <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
          What the map shows
        </h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--muted)]">
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-7 shrink-0 rounded-full"
              style={{ background: '#F2A93B', boxShadow: '0 0 10px #F2A93B88' }}
            />
            The miravnuk&rsquo;s four roads, converging at{' '}
            {PROCESSION_ROUTE.convergesAt}
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-1 w-7 shrink-0 rounded-full"
              style={{ background: '#5FB872' }}
            />
            The ring road — the way round, and the only line here that
            means go
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-0 w-7 shrink-0 border-t-2 border-dashed"
              style={{ borderColor: '#C8BCA8' }}
            />
            Closed stretches, each labelled with its hour
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full border-2"
              style={{ background: '#14100C', border: '2px solid #FFFFFF' }}
            />
            Procession checkpoints — the hour the miravnuk is due there.
            Tap one to see which mandals pass it
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-[#0E1724]"
              style={{ background: '#6C8AB0', border: '1.5px solid #14100C' }}
            >
              P
            </span>
            The {PARKING_COUNT} places the police name for today — chosen
            to stay reachable from the ring
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: '#14100C', border: '2px solid #c9a227' }}
            />
            Stops on another mandal&rsquo;s route — hollow brass, no hour
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                background: '#6fc47f',
                border: '2px solid #14100C',
                boxShadow: '0 0 0 3px rgba(78,138,91,.35)',
              }}
            />
            You, if you press &ldquo;Where am I?&rdquo; — asked for, never
            stored
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: '#CC6600', border: '1.5px solid #14100C' }}
            />
            The mandals the police track, drawn as the same mandal mark in
            the tracker&rsquo;s own status colours — bhagwa on the move,
            green completed, red yet to start. All {mandalCount} in bhagwa
            instead whenever their feed goes quiet
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full border-2"
              style={{ borderColor: '#E2621B', background: '#14100C' }}
            />
            Diversion points — where you are turned around
          </li>
        </ul>
        <p className="prose-measure mt-3 text-[11.5px] leading-relaxed text-[var(--faint)]">
          The roads are the{' '}
          <a
            href={POLICE_SOURCE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--shendur)]"
          >
            {POLICE_SOURCE.authority}&rsquo;s own plan
          </a>{' '}
          — their geometry, not our reconstruction of it. Where the two
          disagreed, theirs wins; they agreed to within 30 m on every road
          we had already drawn.
        </p>
        <p className="prose-measure mt-2 text-[11.5px] leading-relaxed text-[var(--faint)]">
          All {ALL_CHECKPOINTS} checkpoints are marked, each verified to
        sit on the corridor itself rather than merely to share a name —
        the test that rejected a &ldquo;Vaibhav&rdquo; 2.3&nbsp;km away
        and put a &ldquo;Tilak Chowk&rdquo; in Nigdi. Every one lands
        within 40&nbsp;m of the road, most within 7. The hours on them
        are Kasba&rsquo;s, because it is the only mandal to publish an
        hour against each chowk; four of the ten are on Dagdusheth&rsquo;s
        route as well and say so when tapped.{' '}
        {DRAWN_CLOSURES} of the {TOTAL_CLOSURES} closures are drawn. The
          rest name a junction we have no verified position for, and a
          guessed end point draws a confident line down the wrong road —
          so they stay in the list below, where the notice&rsquo;s own
          words are exact. A road missing from the map is not an open
          road. Roads {OSM_CREDIT}.
        </p>
      </div>
  );
}
