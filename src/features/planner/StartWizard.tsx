'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock, ChevronLeft, Footprints, Bike, Car, Sparkles, MapPin,
} from 'lucide-react';
import { MiniMap } from '@/features/map/MiniMapLoader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { usePlan } from '@/hooks/useLocalCollection';
import { useGeolocation } from '@/hooks/useGeolocation';
import { buildItinerary, type DarshanPace, type Interest } from '@/services/itinerary';
import { useCrowdState } from '@/features/crowd/useCrowd';
import { CrowdDot, CROWD_COLOR } from '@/features/crowd/CrowdBadge';
import type { CrowdLevel } from '@/types/crowd';

/** The tracker's own words, so the plan and the tracker never disagree. */
const CROWD_WORD: Record<CrowdLevel, string> = {
  short: 'Short',
  moving: 'Moving',
  long: 'Heavy',
};
import { PUNE_CENTER, formatDuration } from '@/lib/geo';
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

/**
 * Pace changes the plan a lot — it decides whether you queue at Dagdusheth or
 * look from the road — but asking about it up front was a poor question: it
 * is abstract, and you cannot judge the answer before seeing a plan. It now
 * lives on the result, phrased as the outcome rather than the intent, where
 * changing it visibly rewrites the route.
 */
const PACES: Array<{ key: DarshanPace; label: string }> = [
  { key: 'thorough', label: 'Queue at every stop' },
  { key: 'balanced', label: 'A bit of both' },
  { key: 'quick', label: 'Mostly from outside' },
];

const INTERESTS: Array<{ key: Interest; label: string; labelMr?: string }> = [
  { key: 'manache', label: 'मानाचे गणपती', labelMr: 'yes' },
  { key: 'famous', label: 'The famous ones' },
  { key: 'dekhava', label: 'Dekhava & light shows' },
  { key: 'historic', label: 'Historic mandals' },
  { key: 'temple', label: 'Calm temples' },
  { key: 'surprise', label: 'Surprise me' },
];

const MODES: Array<{ key: TravelMode; label: string; icon: typeof Footprints }> = [
  { key: 'walk', label: 'Walking', icon: Footprints },
  { key: 'two_wheeler', label: 'Two-wheeler', icon: Bike },
  { key: 'drive', label: 'Car', icon: Car },
];

export function StartWizard({ mandals }: { mandals: Ganpati[] }) {
  const router = useRouter();
  const { replace } = usePlan();
  const { state: geo, request: requestLocation } = useGeolocation();

  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState<number | null>(null);
  const [pace, setPace] = useState<DarshanPace>('balanced');
  const [interests, setInterests] = useState<Set<Interest>>(new Set());
  const [mode, setMode] = useState<TravelMode>('walk');

  const origin = geo.status === 'ready' ? geo.position : PUNE_CENTER;

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

  const plan = useMemo(() => {
    if (budget === null || step < 2) return null;
    return buildItinerary({
      budgetMinutes: budget,
      interests: [...interests],
      pace,
      mode,
      origin,
      mandals,
      crowdByMandalId,
    });
  }, [budget, interests, pace, mode, origin, mandals, step, crowdByMandalId]);

  const toggleInterest = (key: Interest) => {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const buildRoute = () => {
    setStep(2);
    trackEvent('plan_created', {
      props: { source: 'wizard', budget: budget ?? 0, pace, interests: [...interests].join(',') },
    });
  };

  const useThisPlan = () => {
    if (!plan) return;
    replace(plan.stops.map((s) => s.ganpati.slug));
    router.push('/plan');
  };

  const steps = ['Time', 'What to see', 'Your route'];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-nav pt-[calc(var(--safe-top)+16px)] md:pb-10">
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
          <h1 className="font-display text-[30px] font-bold leading-tight text-[var(--chandan)]">
            How long do you have?
          </h1>
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
          <h1 className="font-display text-[30px] font-bold leading-tight text-[var(--chandan)]">
            What do you want to see?
          </h1>
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

          {geo.status !== 'ready' && (
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

      {/* ---------------- Step 3: result ---------------- */}
      {step === 2 && plan && (
        <section className="mt-6">
          <h1 className="font-display text-[30px] font-bold leading-tight text-[var(--chandan)]">
            Your darshan
          </h1>

          {plan.stops.length === 0 ? (
            <div className="mt-4 surface rounded-[var(--radius-card)] border border-[var(--line)] p-5">
              <p className="text-[15px] font-semibold text-[var(--chandan)]">
                Nothing fits in {formatDuration((budget ?? 0) * 60)}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
                With queuing counted, even one mandal needs more time than
                that. Try a longer window, or a quicker pace.
              </p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setStep(0)}>
                Change my answers
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-[14px] text-[var(--muted)]">
                {plan.stops.length} mandals · about {formatDuration(plan.totalMinutes * 60)} of
                your {formatDuration(plan.budgetMinutes * 60)}
              </p>

              <MiniMap
                mandals={plan.stops.map((s) => s.ganpati)}
                ordered
                className="mt-4 h-56 w-full"
              />

              <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[var(--faint)]">
                <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                  {formatDuration(plan.darshanMinutes * 60)} darshan
                </span>
                <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                  {formatDuration(plan.travelMinutes * 60)} travel
                </span>
              </div>

              {/* Said plainly, because otherwise the same budget quietly
                  produces a different plan at different times of day and
                  looks unreliable rather than current. */}
              {plan.crowdAdjusted && (
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--faint)]">
                  Darshan times allow for what devotees are reporting right now.
                  A mandal with a heavy queue takes more of your{' '}
                  {formatDuration(plan.budgetMinutes * 60)}, so fewer fit.
                </p>
              )}

              {/* Adjusting pace here rewrites the plan in place, so the
                  trade-off is visible instead of hypothetical. */}
              <fieldset className="mt-5">
                <legend className="mb-2 text-[13px] text-[var(--muted)]">
                  Want more mandals, or longer at each one?
                </legend>
                <div className="scroll-x flex gap-2">
                  {PACES.map((p) => (
                    <Chip
                      key={p.key}
                      selected={pace === p.key}
                      onClick={() => setPace(p.key)}
                      
                    >
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              <ol className="mt-4 space-y-2">
                {plan.stops.map((stop, i) => (
                  <li
                    key={stop.ganpati.id}
                    className="flex items-center gap-3 surface rounded-[var(--radius-card)] border border-[var(--line)] p-3"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--shendur)] text-[13px] font-bold text-[#1a0e04]"
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/ganpati/${stop.ganpati.slug}`}
                        className="block truncate text-[14px] font-semibold text-[var(--chandan)]"
                      >
                        {stop.ganpati.name}
                      </Link>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--faint)]">
                        <MapPin size={11} aria-hidden="true" />
                        {stop.ganpati.area.name}
                        <span className="text-[var(--zendu)]">~{stop.darshanMinutes} min</span>
                        {stop.crowd && (
                          <span
                            className="flex items-center gap-1"
                            style={{ color: CROWD_COLOR[stop.crowd] }}
                          >
                            <CrowdDot level={stop.crowd} size={7} />
                            {CROWD_WORD[stop.crowd]} now
                          </span>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              <Button onClick={useThisPlan} size="lg" full className="mt-5">
                Use this route
              </Button>
              <Button
                variant="ghost"
                size="sm"
                full
                className="mt-2"
                onClick={() => setStep(0)}
              >
                Start over
              </Button>

              <p className="mt-4 text-[12px] leading-relaxed text-[var(--faint)]">
                Times are estimates and queues vary a lot by time of day
                {plan.hasUnknownDwell && ', and some mandals have no published queue estimate'}.
                {plan.skipped.length > 0 && (
                  <> {plan.skipped.length} more {plan.skipped.length === 1 ? 'mandal' : 'mandals'} matched
                  what you picked but wouldn&rsquo;t fit — allow more time to include {plan.skipped.length === 1 ? 'it' : 'them'}.</>
                )}
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
