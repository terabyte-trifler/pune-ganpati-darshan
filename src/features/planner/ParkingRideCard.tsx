'use client';

import { Bike, CircleParking, Footprints, Navigation, TriangleAlert } from 'lucide-react';
import { formatDistance, formatDuration } from '@/lib/geo';
import { PARKING_SOURCE } from '@/content/parking';
import type { ParkingChoice } from '@/services/parking-plan';

/**
 * The first leg of a two-wheeler plan: the ride, and where it ends.
 *
 * Two-wheeler mode used to cost every leg at riding speed, which is a
 * journey the police have barricaded — the peth core is closed to traffic
 * during the festival. The plan is now a ride to parking and a walk from
 * there, and this card is the ride.
 *
 * Deliberately the same shape as MetroJourneyCard: both answer "how do I
 * get to the start of the walk", and a rider and a passenger should not
 * have to learn two layouts for the same question.
 *
 * It says why this parking and not the nearest one, because the honest
 * answer is counter-intuitive — the best spot is often a slightly longer
 * ride that saves more walking than it costs.
 */
export function ParkingRideCard({
  choice,
  walkToFirstM,
}: {
  choice: ParkingChoice;
  /** Straight-line metres from the parking to the first mandal. */
  walkToFirstM: number | null;
}) {
  const { spot } = choice;

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
      <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
        <Bike size={13} aria-hidden="true" />
        Ride, then walk
      </h2>

      <ol className="mt-3 flex flex-col gap-3">
        <li className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line-strong)]"
          >
            <Bike size={14} className="text-[var(--shendur)]" />
          </span>
          <span className="min-w-0 text-[14px] leading-snug text-[var(--chandan)]">
            Ride about {formatDuration(choice.rideMinutes * 60)} to{' '}
            <strong className="font-semibold">{spot.name}</strong>
            {spot.kind === 'stretch' && (
              <span className="text-[var(--muted)]">
                {' '}
                — a stretch of road, so look along it
              </span>
            )}
            <span className="mt-0.5 block text-[12px] text-[var(--faint)]">
              Parking no. {spot.no} on the Traffic Police list
            </span>
          </span>
        </li>

        <li className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line-strong)]"
          >
            <Footprints size={14} className="text-[var(--shendur)]" />
          </span>
          <span className="min-w-0 text-[14px] leading-snug text-[var(--chandan)]">
            Leave the vehicle and walk the rest —{' '}
            {formatDuration(choice.walkMinutes * 60)} in all
            {walkToFirstM !== null && (
              <span className="mt-0.5 block text-[12px] text-[var(--faint)]">
                {formatDistance(walkToFirstM)} from the parking to the first
                mandal
              </span>
            )}
          </span>
        </li>
      </ol>

      {choice.detouredForClosures && (
        <p className="prose-measure mt-3 flex gap-2 rounded-[var(--radius-field)] border border-[var(--zendu)]/30 bg-[var(--zendu)]/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
          <TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--zendu)]" />
          <span>
            Roads on the way close after 17:00, so the ride above already
            allows for a diversion. Expect to be sent round — the{' '}
            <a href="/parking#closures" className="font-semibold text-[var(--shendur)]">
              closure list
            </a>{' '}
            shows which stretches.
          </span>
        </p>
      )}

      {/* Where to go if it is full.
          The Traffic Police list says where the spaces are, not whether
          any are left, and on a festival evening the best spot fills
          first. Answering that here beats a rider working it out at 9pm
          while circling. Ordered by how far they are from the spot above,
          because somebody already standing there wants the nearest hop,
          not the second-best plan for a journey they have started. */}
      {choice.alternates.length > 0 && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
            <CircleParking size={13} aria-hidden="true" />
            If it&rsquo;s full
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {choice.alternates.map((alt) => (
              <li key={alt.spot.no} className="flex items-baseline justify-between gap-3">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${alt.spot.lat},${alt.spot.lng}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 text-[13px] text-[var(--chandan)]"
                >
                  <span className="font-semibold">{alt.spot.name}</span>
                  <span className="text-[var(--faint)]">
                    {' '}· {formatDistance(alt.metresFromChosen)} away
                  </span>
                  {alt.approachClosed && (
                    <span className="block text-[11px] text-[var(--zendu)]">
                      on a road that closes after 17:00
                    </span>
                  )}
                </a>
                <span className="shrink-0 text-[12px] text-[var(--faint)]">
                  {alt.extraWalkMinutes > 0
                    ? `+${alt.extraWalkMinutes} min walk`
                    : alt.extraWalkMinutes < 0
                      ? `${alt.extraWalkMinutes} min walk`
                      : 'same walk'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=driving`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)]"
      >
        <Navigation size={13} aria-hidden="true" />
        Directions to the parking
      </a>

      <p className="prose-measure mt-2 flex gap-2 border-t border-[var(--line)] pt-3 text-[12px] leading-relaxed text-[var(--faint)]">
        <CircleParking size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          Chosen for the whole journey rather than the shortest ride: a spot a
          little further out often saves more walking than it costs, and after
          17:00 a ride that has to go round a closure is priced as the longer
          ride it is. The peths are closed to vehicles in the evening, so the
          rest is on foot either way — closures do not stop you walking.
        </span>
      </p>
      <p className="prose-measure mt-1.5 flex gap-2 text-[12px] leading-relaxed text-[var(--faint)]">
        <TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--zendu)]" />
        <span>
          {PARKING_SOURCE.authority}&rsquo;s published plan, not a live view —
          it does not say whether this one is full tonight.
        </span>
      </p>
    </section>
  );
}
