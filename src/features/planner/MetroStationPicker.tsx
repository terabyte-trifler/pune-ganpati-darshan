'use client';

import { useState } from 'react';
import { TrainFront, ChevronDown, TriangleAlert } from 'lucide-react';
import {
  ARRIVAL_STATIONS, EXIT_ONLY_STATIONS, PRIMARY_STATIONS,
  LINE_COLOR, LINE_NAME, primaryLine,
  type MetroStation,
} from '@/lib/metro';
import { haversine, formatDistance, type LatLng } from '@/lib/geo';
import { cn } from '@/lib/utils';

/**
 * Which station you get off at.
 *
 * Shown only in metro mode, where it is the single decision that changes
 * the route — the plan is walked either way, so the station is the origin
 * and nothing else about it varies. The station you get ON at is not a
 * choice and is not offered: it is wherever you happen to be, which the
 * journey card works out from your location.
 *
 * Only stations you can ARRIVE at are offered. Mandai is not one of them
 * during the festival, and its absence is explained rather than left to be
 * noticed: it is the nearest station to most of the southern peths, so a
 * visitor who knows the network will assume the app has a bug unless it
 * says otherwise.
 *
 * The two peth stations are laid out as equals. The two Aqua Line ones are
 * behind a disclosure, because they are the rare answer rather than a third
 * and fourth option: both are across the river and 20–30 minutes' walk from
 * the nearest mandal, so putting them in the same row would present a bad
 * choice as an equal one. Hiding them entirely would be worse — someone
 * coming from Kothrud genuinely arrives that way.
 */

function StationButton({
  station, selected, onSelect, distanceM,
}: {
  station: MetroStation;
  selected: boolean;
  onSelect: () => void;
  distanceM: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 flex-1 flex-col items-start gap-0.5 rounded-[var(--radius-field)] border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-[var(--shendur)] bg-[var(--shendur)]/10'
          : 'border-[var(--line)] bg-[var(--dhoop)] hover:border-[var(--shendur)]/40'
      )}
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: LINE_COLOR[primaryLine(station)] }}
        />
        <span className="text-[14px] font-semibold text-[var(--chandan)]">
          {station.name}
        </span>
      </span>
      <span className="text-[12px] text-[var(--faint)]">
        {LINE_NAME[primaryLine(station)]}
        {distanceM !== null && ` · ${formatDistance(distanceM)} away`}
      </span>
    </button>
  );
}

export function MetroStationPicker({
  value, onChange, userLocation,
}: {
  value: MetroStation;
  onChange: (station: MetroStation) => void;
  /** Used only to show how far each station is. Never leaves the device. */
  userLocation: LatLng | null;
}) {
  const secondary = ARRIVAL_STATIONS.filter((s) => s.tier === 'secondary');
  // Open if the current choice is in there, so the selection is never hidden.
  const [showRare, setShowRare] = useState(value.tier === 'secondary');

  const distanceTo = (s: MetroStation) =>
    userLocation ? haversine(userLocation, { lat: s.lat, lng: s.lng }) : null;

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-[var(--faint)]">
        <TrainFront size={13} aria-hidden="true" />
        Get off at
      </h2>

      <div className="flex flex-col gap-2 sm:flex-row">
        {PRIMARY_STATIONS.map((s) => (
          <StationButton
            key={s.id}
            station={s}
            selected={value.id === s.id}
            onSelect={() => onChange(s)}
            distanceM={distanceTo(s)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowRare((v) => !v)}
        aria-expanded={showRare}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] text-[var(--muted)]"
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('transition-transform', showRare && 'rotate-180')}
        />
        Coming from Deccan or JM Road?
      </button>

      {showRare && (
        <>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            {secondary.map((s) => (
              <StationButton
                key={s.id}
                station={s}
                selected={value.id === s.id}
                onSelect={() => onChange(s)}
                distanceM={distanceTo(s)}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--faint)]">
            Both are across the river, so the walk in is 20–30 minutes before
            the first mandal. Worth it only if you are already on the Aqua
            Line — otherwise change at Civil Court for the Purple Line and
            get off at Kasba Peth for the peths or Swargate for Sarasbaug.
          </p>
        </>
      )}

      <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
        {value.exitNote}
      </p>

      {/* Says why the obvious station is missing. Without this the list
          looks incomplete to anyone who knows the line. */}
      {EXIT_ONLY_STATIONS.map((s) => (
        <p
          key={s.id}
          className="mt-2 flex gap-1.5 rounded-[var(--radius-field)] border border-[var(--zendu)]/30 bg-[var(--zendu)]/10 px-2.5 py-2 text-[12px] leading-relaxed text-[var(--muted)]"
        >
          <TriangleAlert
            size={13}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--zendu)]"
          />
          <span>
            <strong className="font-semibold text-[var(--chandan)]">
              No getting off at {s.name}.
            </strong>{' '}
            {s.alightNote}
          </span>
        </p>
      ))}
    </div>
  );
}
