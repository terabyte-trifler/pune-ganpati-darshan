'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock, ChevronLeft, Footprints, Bike, TrainFront, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { usePlan } from '@/hooks/useLocalCollection';
import { useGeolocation, useResolveLocation } from '@/hooks/useGeolocation';
import { buildItinerary, type DarshanPace, type Interest } from '@/services/itinerary';
import { useCrowdState } from '@/features/crowd/useCrowd';
import type { CrowdLevel } from '@/types/crowd';

import { PUNE_CENTER, type LatLng } from '@/lib/geo';
import { MetroStationPicker } from './MetroStationPicker';
import { stationById, PRIMARY_STATIONS, type MetroStation } from '@/lib/metro';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { Ganpati, TravelMode } from '@/types/ganpati';

/**
 * Two-question route builder: how long you have, and what you want to see.
 *
 * The whole thing runs on the device. The catalogue is already loaded, dwell
 * times are data, and the ordering solver is local — so there is no request,
 * no spinner and no cost, and it works with the network down.
 */

const BUDGETS = [
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1½ hours' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: '4 hours' },
  { minutes: 360, label: '6 hours' },
];


const INTERESTS: Array<{ key: Interest; label: string; labelMr?: string }> = [
  { key: 'manache', label: 'मानाचे गणपती', labelMr: 'yes' },
  { key: 'famous', label: 'The famous ones' },
  { key: 'dekhava', label: 'Dekhava & light shows' },
  { key: 'historic', label: 'Historic mandals' },
  { key: 'temple', label: 'Calm temples' },
  { key: 'surprise', label: 'Surprise me' },
];

/**
 * Car is gone: the peths are closed to vehicles through the festival, so a
 * driving plan ends at a barricade with every stop still ahead of it. Metro
 * takes its place — and unlike car, it changes where the route STARTS
 * rather than how fast it moves, which is why picking it reveals a station.
 */
const MODES: Array<{ key: TravelMode; label: string; icon: typeof Footprints }> = [
  { key: 'walk', label: 'Walking', icon: Footprints },
  { key: 'two_wheeler', label: 'Two-wheeler', icon: Bike },
  { key: 'metro', label: 'Metro', icon: TrainFront },
];

export function StartWizard({
  mandals, embedded = false, onDone,
}: {
  mandals: Ganpati[];
  /**
   * Rendered inside the planner rather than on a page of its own.
   *
   * Drops the outer page padding, which the host already provides, and
   * demotes the step headings to h2 — the planner owns the h1, and two of
   * them on one page is a real problem for anyone navigating by heading.
   */
  embedded?: boolean;
  /**
   * Called once the route has been written to the plan, with what the
   * planner needs to explain the result — chiefly how many matching
   * mandals did not fit, which is the one thing the old result screen
   * said that the stop list itself cannot.
   */
  onDone?: (built: { skipped: number; budgetMinutes: number }) => void;
}) {
  const router = useRouter();
  const { replace } = usePlan();
  const { state: geo, request: requestLocation } = useGeolocation();
  // Same reason as the planner: a cold open of /start otherwise builds
  // the route from the city centre despite location being granted.
  useResolveLocation();

  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState<number | null>(null);
  /**
   * Fixed at the sensible middle while building. The planner owns pace now
   * and lets you change it against the route you actually got, which is
   * where the question can be answered — it was asked here, before there
   * was anything to judge it against.
   */
  const pace: DarshanPace = 'balanced';
  const [interests, setInterests] = useState<Set<Interest>>(new Set());
  const [mode, setMode] = useState<TravelMode>('walk');
  /**
   * Kasba Peth by default. Mandai has more mandals inside a ten-minute
   * walk and would otherwise be the obvious guess, but it is boarding-only
   * during the festival — so the best station you can actually arrive at
   * is the one above it on the Purple Line.
   */
  const [station, setStation] = useState<MetroStation>(
    () => stationById('kasba-peth') ?? PRIMARY_STATIONS[0]
  );

  /**
   * In metro mode the route begins where the train leaves you, not where
   * you are standing now — you are probably reading this before you set
   * out. Location still matters, but only to show which station is nearest.
   */
  const origin: LatLng = useMemo(
    () =>
      mode === 'metro'
        ? { lat: station.lat, lng: station.lng }
        : geo.status === 'ready'
          ? geo.position
          : PUNE_CENTER,
    [mode, station, geo]
  );

  /**
   * Live crowd, from the same shared store the tracker reads. No extra
   * request: the poller is already running for the rest of the app.
   */
  const crowdState = useCrowdState();
  const crowdByMandalId = useMemo(() => {
    const out: Record<string, CrowdLevel | null> = {};
    for (const g of mandals) out[g.id] = crowdState.byMandalId[g.id]?.status ?? null;
    return out;
  }, [mandals, crowdState]);


  const toggleInterest = (key: Interest) => {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /**
   * Build and take, in one action.
   *
   * There used to be a result screen with a "Use this route" button on it.
   * Nobody builds a route in order to reject it, and confirming it a second
   * time bought nothing — the route was already on screen, and the planner
   * below shows the same stops with the same times in its own layout, so
   * the step was asking people to choose between two views of one thing.
   *
   * The plan is written here and the planner takes over. Undo is the plan
   * itself: every stop can be removed or reordered, and "Build a different
   * route" is one tap away.
   */
  const buildRoute = () => {
    const built = buildItinerary({
      budgetMinutes: budget ?? 0,
      interests: [...interests],
      pace,
      mode,
      origin,
      mandals,
      crowdByMandalId,
    });

    replace(built.stops.map((s) => s.ganpati.slug));
    trackEvent('plan_created', {
      props: {
        source: 'wizard',
        budget: budget ?? 0,
        pace,
        interests: [...interests].join(','),
        stops: built.stops.length,
      },
    });

    if (onDone) onDone({ skipped: built.skipped.length, budgetMinutes: budget ?? 0 });
    else router.push('/plan');
  };

  const steps = ['Time', 'What to see'];

  /**
   * The step heading. An <h1> on its own page, an <h2> inside the planner,
   * which already has one.
   */
  const Heading = embedded ? 'h2' : 'h1';

  return (
    <div
      className={
        embedded
          ? ''
          : 'mx-auto max-w-2xl px-4 pb-nav pt-[calc(var(--safe-top)+16px)] md:pb-10'
      }
    >
      {/* ---------------- Progress ---------------- */}
      <div className="flex items-center gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line-strong)] text-[var(--muted)]"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
        )}
        <ol className="flex flex-1 gap-1.5" aria-label="Progress">
          {steps.map((label, i) => (
            <li key={label} className="flex-1">
              <span className="sr-only">
                {label}
                {i === step ? ' (current step)' : ''}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'block h-1 rounded-full transition-colors',
                  i <= step ? 'bg-[var(--shendur)]' : 'bg-[var(--line-strong)]'
                )}
              />
            </li>
          ))}
        </ol>
      </div>

      {/* ---------------- Step 1: time ---------------- */}
      {step === 0 && (
        <section className="mt-6">
          <Heading className="font-display text-[30px] font-bold leading-tight text-[var(--chandan)]">
            How long do you have?
          </Heading>
          <p lang="mr" className="mt-1 text-[14px] text-[var(--muted)]">किती वेळ आहे?</p>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
            We&rsquo;ll count queuing as well as walking — at the big mandals
            the queue is most of the time.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BUDGETS.map((b) => (
              <button
                key={b.minutes}
                type="button"
                onClick={() => { setBudget(b.minutes); setStep(1); }}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-[var(--radius-card)] border p-4 text-left transition-colors',
                  budget === b.minutes
                    ? 'border-[var(--shendur)] bg-[var(--shendur)]/10'
                    : 'border-[var(--line)] bg-[var(--dhoop)] hover:border-[var(--shendur)]/40'
                )}
              >
                <Clock size={16} aria-hidden="true" className="text-[var(--shendur)]" />
                <span className="text-[16px] font-bold text-[var(--chandan)]">{b.label}</span>
              </button>
            ))}
          </div>

          <Link
            href="/explore"
            className="mt-4 inline-flex min-h-11 items-center text-[13px] text-[var(--faint)] underline"
          >
            Skip — let me browse on my own
          </Link>
        </section>
      )}

      {/* ---------------- Step 2: what to see ---------------- */}
      {step === 1 && (
        <section className="mt-6">
          <Heading className="font-display text-[30px] font-bold leading-tight text-[var(--chandan)]">
            What do you want to see?
          </Heading>
          <p className="mt-2 text-[14px] text-[var(--muted)]">Pick as many as you like.</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <Chip
                key={i.key}
                selected={interests.has(i.key)}
                onClick={() => toggleInterest(i.key)}
                lang={i.labelMr ? 'mr' : undefined}
                className="text-[14px]"
              >
                {i.label}
              </Chip>
            ))}
          </div>

          <h2 className="mb-2 mt-6 text-[13px] font-bold uppercase tracking-wide text-[var(--faint)]">
            Getting around
          </h2>
          <div className="flex flex-wrap gap-2">
            {MODES.map(({ key, label, icon: Icon }) => (
              <Chip
                key={key}
                selected={mode === key}
                onClick={() => setMode(key)}
                className="inline-flex items-center gap-1.5 text-[14px]"
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </Chip>
            ))}
          </div>

          {mode === 'metro' && (
            <div className="mt-5">
              <MetroStationPicker
                value={station}
                onChange={setStation}
                userLocation={geo.status === 'ready' ? geo.position : null}
              />
            </div>
          )}

          {mode !== 'metro' && geo.status !== 'ready' && (
            <button
              type="button"
              onClick={requestLocation}
              className="mt-5 w-full rounded-[var(--radius-field)] border border-dashed border-[var(--line-strong)] px-3 py-2.5 text-left text-[13px] text-[var(--muted)]"
            >
              Starting from <span className="text-[var(--chandan)]">Pune city centre</span>.
              <span className="ml-1 font-semibold text-[var(--shendur)]">Use my location →</span>
            </button>
          )}

          <Button onClick={buildRoute} size="lg" full className="mt-6">
            <Sparkles size={17} aria-hidden="true" />
            Build my route
          </Button>
        </section>
      )}

    </div>
  );
}
