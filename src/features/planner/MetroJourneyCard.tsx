'use client';

import { TrainFront, LocateFixed, Loader2, Footprints } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  planMetroJourney, journeySeconds, LINE_COLOR, LINE_NAME, primaryLine,
  type MetroStation,
} from '@/lib/metro';
import { formatDistance, formatDuration, estimateDurationSeconds } from '@/lib/geo';

/**
 * Which train to take, and where to get off.
 *
 * The rest of the app treats the metro as an anchor — it decides where a
 * route begins. That is true of the walk, but it is not the whole of what
 * someone standing in Kalyani Nagar needs: they need to know they board at
 * Kalyani Nagar, change at Civil Court, and get off at Mandai. This is the
 * surface that says so.
 *
 * Location is used for exactly one thing: finding the nearest station to
 * board at. It is never sent anywhere — the whole journey is computed on
 * the device from a station list in lib/metro, because the network is two
 * lines and one interchange, which does not need a server.
 *
 * When location is refused the card still works. It drops the boarding
 * half and shows where to get off, which is the half the plan already
 * knows and the half that does not depend on where anyone is standing.
 */

const DOT = 'h-3 w-3 shrink-0 rounded-full border-2 border-[var(--ink)]';

/**
 * Below this the walk is not worth a number.
 *
 * "0 m from you" is what a distance formatter says when you are standing
 * on the platform, and it reads like a bug rather than like good news. It
 * is also the common case for anyone who opens the app on their way in.
 */
const AT_STATION_M = 150;

function boardDistance(metres: number): string {
  return metres < AT_STATION_M
    ? 'you\u2019re right by it'
    : `${formatDistance(metres)} from you`;
}

function Connector({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex w-3 justify-center">
        <span
          aria-hidden="true"
          className="w-[3px] rounded-full"
          style={{ background: color }}
        />
      </div>
      <p className="py-1.5 text-[12px] text-[var(--faint)]">{label}</p>
    </div>
  );
}

function Stop({
  color, title, detail,
}: {
  color: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={DOT}
        style={{ background: color, marginTop: '0.3rem' }}
      />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-tight text-[var(--chandan)]">
          {title}
        </p>
        {detail && (
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--muted)]">{detail}</p>
        )}
      </div>
    </div>
  );
}

export function MetroJourneyCard({
  alight, walkToFirstM, firstStopName,
}: {
  /** Where the plan says to get off. */
  alight: MetroStation;
  /** Straight-line metres from that station to the first mandal. */
  walkToFirstM: number | null;
  firstStopName?: string;
}) {
  const { state, request } = useGeolocation();
  const here = state.status === 'ready' ? state.position : null;
  const journey = here ? planMetroJourney(here, alight) : null;

  const walkOut =
    walkToFirstM === null ? null : (
      <>
        {formatDistance(walkToFirstM)} on foot
        {firstStopName && <> to {firstStopName.replace(/^(Shri|Shrimant)\s+/i, '')}</>}
        {' · about '}
        {formatDuration(estimateDurationSeconds(walkToFirstM, 'walk'))}
      </>
    );

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
      <h2 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
        <TrainFront size={13} aria-hidden="true" />
        Getting there by metro
      </h2>

      <div className="mt-3 flex flex-col">
        {/* ---------- The boarding half, only once we know where you are ---------- */}
        {journey && !journey.alreadyThere && (
          <>
            <Stop
              color={LINE_COLOR[journey.legs[0].line]}
              title={<>Board at {journey.board.name}</>}
              detail={
                <>
                  {LINE_NAME[journey.legs[0].line]} towards {journey.legs[0].towards}
                  {' · '}
                  {boardDistance(journey.boardDistanceM)}
                </>
              }
            />
            {journey.legs.map((leg, i) => (
              <div key={leg.line + i}>
                <Connector
                  color={LINE_COLOR[leg.line]}
                  label={`${leg.stops} ${leg.stops === 1 ? 'stop' : 'stops'}`}
                />
                {i < journey.legs.length - 1 && journey.interchange && (
                  <Stop
                    color={LINE_COLOR[journey.legs[i + 1].line]}
                    title={<>Change at {journey.interchange.name}</>}
                    detail={
                      <>
                        {LINE_NAME[journey.legs[i + 1].line]} towards{' '}
                        {journey.legs[i + 1].towards}
                      </>
                    }
                  />
                )}
              </div>
            ))}
          </>
        )}

        {/* ---------- Where you get off. Always known. ---------- */}
        <Stop
          color={LINE_COLOR[primaryLine(alight)]}
          title={
            journey?.alreadyThere ? (
              <>You&rsquo;re at {alight.name} already</>
            ) : (
              <>Get off at {alight.name}</>
            )
          }
          detail={
            journey || walkOut ? (
              <>
                {!journey && <>{LINE_NAME[primaryLine(alight)]}. </>}
                {walkOut}
              </>
            ) : (
              LINE_NAME[primaryLine(alight)]
            )
          }
        />

        {walkOut && (
          <div className="mt-2 flex items-center gap-3">
            <span className="flex w-3 justify-center">
              <Footprints size={13} aria-hidden="true" className="text-[var(--faint)]" />
            </span>
            <p className="text-[12px] leading-relaxed text-[var(--muted)]">
              {alight.exitNote}
            </p>
          </div>
        )}
      </div>

      {/* ---------- Totals, deliberately coarse ---------- */}
      {journey && journey.totalStops > 0 && (
        <p className="mt-3 border-t border-[var(--line)] pt-2.5 text-[12px] text-[var(--faint)]">
          About {formatDuration(journeySeconds(journey))} on the train
          {journey.legs.length > 1 && ', including the change'}. No live
          timetable behind this — it assumes a stop every couple of minutes.
        </p>
      )}

      {/* ---------- Ask for location, once, and explain why ---------- */}
      {!here && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            onClick={request}
            disabled={state.status === 'locating'}
            className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)] disabled:opacity-60"
          >
            {state.status === 'locating' ? (
              <><Loader2 size={14} className="animate-spin" aria-hidden="true" />Finding you…</>
            ) : (
              <><LocateFixed size={14} aria-hidden="true" />Which train do I take?</>
            )}
          </button>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--faint)]">
            {state.status === 'denied'
              ? 'Location is off in your browser, so we can’t tell which station is nearest you. Where to get off is above either way.'
              : state.status === 'unavailable'
                ? 'We couldn’t get your location. Where to get off is above either way.'
                : 'Finds the station nearest you so we can name the line and direction. It stays on your device.'}
          </p>
        </div>
      )}

      {/* ---------- Located, but nowhere near the network ---------- */}
      {here && !journey && (
        <p className="mt-3 border-t border-[var(--line)] pt-2.5 text-[12px] leading-relaxed text-[var(--faint)]">
          No metro station within walking distance of you — the network is
          two lines, and much of Pune is not on either. {alight.name} is
          still where you want to end up.
        </p>
      )}
    </section>
  );
}
