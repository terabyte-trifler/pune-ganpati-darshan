import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Calculator } from 'lucide-react';
import { getSessionUser } from '@/services/auth';
import { getAllGanpatis, getFestivalConfig } from '@/services/ganpati';
import { getFestivalPhase, type FestivalPhase } from '@/lib/festival';
import { crowdExpectation, type CrowdExpectation } from '@/services/crowd/crowd-prior';

export const metadata = { title: 'Crowd prior', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * The prior, with its arithmetic shown.
 *
 * Lane A can be audited by reading the reports behind it. Lane B has no
 * reports, so the only way to hold it to account is to print every
 * intermediate value and let someone who knows Pune say "that is wrong".
 * That is the whole purpose of this page: the model is a set of
 * judgements about hour-of-day and festival-day load, and judgements need
 * to be visible to be corrected.
 *
 * It takes `day` and `hour` from the query string so any moment of the
 * festival can be inspected without waiting for it — including the hours
 * nobody will be awake to check.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function clampInt(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

/** Signed to 3dp, monospace-friendly. */
const f3 = (n: number) => n.toFixed(3);

export default async function AdminCrowdPriorPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; hour?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/crowd-prior');
  if (!user.isAdmin) redirect('/');

  const [ganpatis, config] = await Promise.all([getAllGanpatis(), getFestivalConfig()]);
  const livePhase = getFestivalPhase(config);
  const sp = await searchParams;

  const totalDays =
    livePhase.phase === 'during'
      ? livePhase.totalDays
      : Math.round(
          (Date.parse(`${config.endDate}T00:00:00Z`) -
            Date.parse(`${config.startDate}T00:00:00Z`)) /
            86_400_000
        ) + 1;

  const liveDay = livePhase.phase === 'during' ? livePhase.day : 1;
  const day = clampInt(sp.day, 1, totalDays, liveDay);
  const hour = clampInt(sp.hour, 0, 23, 21);

  const visarjanDay =
    Math.round(
      (Date.parse(`${config.visarjanDate}T00:00:00Z`) -
        Date.parse(`${config.startDate}T00:00:00Z`)) /
        86_400_000
    ) + 1;

  const phase: FestivalPhase = {
    phase: 'during',
    day,
    totalDays,
    isVisarjan: day === visarjanDay,
  };

  // The calendar date for the chosen festival day, so the weekday — which
  // the model uses — is the real one rather than today's.
  const dateMs = Date.parse(`${config.startDate}T00:00:00.000Z`) + (day - 1) * 86_400_000;
  const at = new Date(dateMs - IST_OFFSET_MS + hour * 3_600_000);
  const weekday = new Date(dateMs).toUTCString().slice(0, 3);

  const rows = ganpatis
    .map((g) => ({
      g,
      e: crowdExpectation(
        {
          darshanMinutes: g.darshanMinutes,
          peakDarshanMinutes: g.peakDarshanMinutes,
          prominence: g.prominence,
        },
        phase,
        at
      ),
    }))
    .sort((a, b) => (b.e?.waitMinutes ?? -1) - (a.e?.waitMinutes ?? -1));

  const shown = rows.filter((r) => r.e) as { g: (typeof rows)[0]['g']; e: CrowdExpectation }[];
  const counts = shown.reduce<Record<string, number>>((acc, r) => {
    acc[r.e.level] = (acc[r.e.level] ?? 0) + 1;
    return acc;
  }, {});
  const estimated = shown.filter((r) => r.e.basis === 'estimated').length;
  const w = shown[0]?.e.workings;

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--muted)]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Admin
        </Link>

        <h1 className="font-display mt-2 flex items-center gap-2 text-[26px] font-bold text-[var(--chandan)]">
          <Calculator size={20} aria-hidden="true" className="text-[var(--shendur)]" />
          Crowd prior
        </h1>
        <p className="prose-measure mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
          Lane B, with its arithmetic. This is what the app shows when nobody
          has reported a mandal — an expectation from the clock and the
          mandal&rsquo;s own curated wait times, never a report. Nothing on this
          page contributes mass to a measured status.
        </p>

        {/* ---------------- Time picker ---------------- */}
        <form className="mt-5 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            Festival day
            <input
              type="number"
              name="day"
              min={1}
              max={totalDays}
              defaultValue={day}
              className="w-24 rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--raat)] px-2.5 py-2 font-mono text-[14px] text-[var(--chandan)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            IST hour
            <input
              type="number"
              name="hour"
              min={0}
              max={23}
              defaultValue={hour}
              className="w-24 rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--raat)] px-2.5 py-2 font-mono text-[14px] text-[var(--chandan)]"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-[var(--radius-chip)] border border-[var(--shendur)]/50 px-4 text-[14px] font-semibold text-[var(--shendur)]"
          >
            Recompute
          </button>
          <p className="text-[12px] leading-relaxed text-[var(--faint)]">
            Day {day} of {totalDays} · {weekday} ·{' '}
            {String(hour).padStart(2, '0')}:00 IST
            {phase.isVisarjan && ' · visarjan day'}
            <br />
            Live now: {livePhase.phase === 'during' ? `day ${livePhase.day}` : livePhase.phase}
          </p>
        </form>

        {/* ---------------- Shared factors ---------------- */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {w ? (
            [
              ['hourFactor', f3(w.hourFactor), `HOUR_LOAD interpolated at ${w.istHour.toFixed(2)}`],
              ['phaseFactor', f3(w.phaseFactor), `day ${w.festivalDay}/${w.totalDays}${w.isVisarjan ? ', visarjan' : ''}`],
              ['weekendBonus', f3(w.weekendBonus), `IST day of week ${w.istDayOfWeek}`],
              ['dayFactor', f3(w.dayFactor), 'min(1, phase + weekend)'],
            ] as const
          ).map(([k, v, note]) => (
            <div key={k} className="rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] p-3">
              <p className="font-mono text-[11px] text-[var(--faint)]">{k}</p>
              <p className="mt-0.5 font-mono text-[20px] font-bold tabular-nums text-[var(--zendu)]">{v}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--faint)]">{note}</p>
            </div>
          )) : (
            <p className="text-[13px] text-[var(--muted)]">
              The prior is silent at this time — visarjan afternoon, or outside
              the festival.
            </p>
          )}
        </div>

        <p className="mt-3 text-[12px] text-[var(--muted)]">
          {shown.length} of {ganpatis.length} mandals given an expectation ·{' '}
          {estimated} from estimated wait times ·{' '}
          {Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}
        </p>

        {/* ---------------- Per-mandal derivation ---------------- */}
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--line)]">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[var(--dhoop-2)] text-left">
                {[
                  'Mandal', 'basis', 'normal', 'peak', 'quiet',
                  'load', 'wait', 'level',
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-[var(--line)] px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ g, e }) => (
                <tr key={g.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2 text-[var(--chandan)]">
                    <Link href={`/ganpati/${g.slug}`} className="hover:text-[var(--shendur)]">
                      {g.name}
                    </Link>
                    <span className="ml-2 text-[11px] text-[var(--faint)]">
                      prom {g.prominence}
                    </span>
                  </td>
                  {e ? (
                    <>
                      <td className="px-3 py-2">
                        <span
                          className={
                            e.basis === 'curated'
                              ? 'text-[var(--muted)]'
                              : 'font-semibold text-[var(--zendu)]'
                          }
                        >
                          {e.basis}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-[var(--muted)]">
                        {e.workings.normalMinutes}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-[var(--muted)]">
                        {e.workings.peakMinutes}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-[var(--faint)]">
                        {e.workings.quietMinutes.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-[var(--faint)]">
                        {f3(e.workings.load)}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold tabular-nums text-[var(--chandan)]">
                        ~{e.waitMinutes}m
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="font-semibold"
                          style={{
                            color:
                              e.level === 'long'
                                ? 'var(--crowd-long)'
                                : e.level === 'moving'
                                  ? 'var(--crowd-moving)'
                                  : 'var(--crowd-short)',
                          }}
                        >
                          {e.level}
                        </span>
                      </td>
                    </>
                  ) : (
                    <td colSpan={7} className="px-3 py-2 text-[var(--faint)]">
                      silent
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---------------- The formula, written out ---------------- */}
        <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            The whole model
          </h2>
          <pre className="mt-2.5 overflow-x-auto font-mono text-[12px] leading-[1.7] text-[var(--muted)]">
{`load  = hourFactor(istHour) × min(1, phaseFactor + weekendBonus)
quiet = normalMinutes × 0.25
wait  = quiet + load × (peakMinutes − quiet)

level = wait ≥ 30 → long | wait ≥ 10 → moving | short

normal/peak come from the catalogue where curated (18 of 29).
Otherwise peak = 12 and normal = 5, which cannot reach "long"
by design — an estimated mandal is never called heavy.

Silent on visarjan day from 13:00 IST: the idols are in the
procession and we do not know which mandaps are still open.`}
          </pre>
        </div>
      </div>
    </main>
  );
}
