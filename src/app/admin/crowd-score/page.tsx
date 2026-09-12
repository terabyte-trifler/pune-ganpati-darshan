import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sigma, TriangleAlert } from 'lucide-react';
import { getSessionUser } from '@/services/auth';
import { getAllGanpatis, getFestivalConfig } from '@/services/ganpati';
import { getFestivalPhase } from '@/lib/festival';
import { getCrowdExplain } from '@/services/crowd/crowd-service';
import {
  crowdExpectation, LONG_THRESHOLD_MIN, SHORT_THRESHOLD_MIN, QUIET_FRACTION,
} from '@/services/crowd/crowd-prior';
import { decide, type Decider } from '@/services/crowd/crowd-decision';
import {
  MIN_DEVICES_FOR_STATUS, ACTIVE_WINDOW_MINUTES, FRESHNESS_HALF_LIFE_MINUTES,
  OFFSITE_WEIGHT, DWELL_MASS, DWELL_MASS_CAP,
} from '@/services/crowd/crowd-aggregation';
import type { CrowdLevel } from '@/types/crowd';

export const metadata = { title: 'Crowd score', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Every mandal: which rule decided what a visitor sees, and the whole
 * arithmetic behind it.
 *
 * Nothing here is reimplemented. Scores come from `scoreBreakdown`, the
 * live and human-only statuses from `aggregateMandal`, the prior from
 * `crowdExpectation`, and the lane from `decide` — the same functions the
 * public site runs. An explainer that recomputes separately can disagree
 * with the page it explains.
 */

const COLOR: Record<CrowdLevel, string> = {
  short: 'var(--crowd-short)',
  moving: 'var(--crowd-moving)',
  long: 'var(--crowd-long)',
};
const WORD: Record<CrowdLevel, string> = { short: 'Green · Short', moving: 'Yellow · Moving', long: 'Red · Heavy' };

const DECIDER: Record<Decider, { label: string; note: string }> = {
  measured: { label: 'Phase 0 · measured', note: 'Two or more devices agreed. Shown on map pin, explore badge and panel.' },
  'dwell-tipped': { label: 'Phase 2 · dwell decided', note: 'Humans alone would have shown a different colour. Dwell changed it.' },
  unconfirmed: { label: 'One report · not confirmed', note: 'No colour on map or badge. Panel shows "Not confirmed yet" plus the Phase 1 estimate.' },
  prior: { label: 'Phase 1 · usually', note: 'Nobody reported. Panel only, hollow ring — never on a pin or badge.' },
  silent: { label: 'Silent', note: 'Nobody reported and the prior declines (outside the festival, or visarjan afternoon).' },
};

const n3 = (v: number) => v.toFixed(3);

function Swatch({ level, hollow = false }: { level: CrowdLevel | null; hollow?: boolean }) {
  if (!level) return <span className="inline-block h-3 w-3 rounded-full border border-[var(--line-strong)]" />;
  return (
    <span
      className="inline-block h-3 w-3 rounded-full"
      style={hollow ? { border: `2px solid ${COLOR[level]}` } : { background: COLOR[level] }}
    />
  );
}

export default async function AdminCrowdScorePage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/crowd-score');
  if (!user.isAdmin) redirect('/');

  const [explain, ganpatis, config] = await Promise.all([
    getCrowdExplain(),
    getAllGanpatis(),
    getFestivalConfig(),
  ]);
  const phase = getFestivalPhase(config);
  const byId = new Map(ganpatis.map((g) => [g.id, g]));
  const now = new Date();

  if (!explain) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <p className="text-[14px] text-[var(--muted)]">Crowd data is unreachable, so there is nothing to explain.</p>
      </main>
    );
  }

  const rows = explain.mandals.map((m) => {
    const g = byId.get(m.mandalId);
    const prior = g
      ? crowdExpectation(
          { darshanMinutes: g.darshanMinutes, peakDarshanMinutes: g.peakDarshanMinutes, prominence: g.prominence },
          phase,
          now
        )
      : null;
    return { ...m, g, prior, decision: decide(m.status, m.humanOnly, prior) };
  });

  const ORDER: Decider[] = ['dwell-tipped', 'measured', 'unconfirmed', 'prior', 'silent'];
  rows.sort(
    (a, b) =>
      ORDER.indexOf(a.decision.decider) - ORDER.indexOf(b.decision.decider) ||
      b.breakdown.mass - a.breakdown.mass
  );
  const tally = ORDER.map((d) => [d, rows.filter((r) => r.decision.decider === d).length] as const);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-4xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <Link href="/admin" className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--muted)]">
          <ArrowLeft size={14} aria-hidden="true" />
          Admin
        </Link>

        <h1 className="font-display mt-2 flex items-center gap-2 text-[26px] font-bold text-[var(--chandan)]">
          <Sigma size={20} aria-hidden="true" className="text-[var(--shendur)]" />
          Crowd score
        </h1>
        <p className="prose-measure mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
          All {rows.length} mandals, right now: which rule decided what visitors
          see, and every number behind it. Computed by the same functions the
          public site runs, uncached.
        </p>

        {/* ---------------- Summary ---------------- */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tally.map(([d, count]) => (
            <div key={d} className="rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] p-2.5">
              <p className="text-[11px] leading-snug text-[var(--faint)]">{DECIDER[d].label}</p>
              <p className="mt-0.5 font-mono text-[20px] font-bold tabular-nums text-[var(--chandan)]">{count}</p>
            </div>
          ))}
        </div>

        <p
          className={`mt-3 flex items-start gap-2 rounded-[var(--radius-field)] border px-3 py-2.5 text-[12.5px] leading-relaxed ${
            explain.dwellCounted ? 'border-[var(--shendur)]/40 text-[var(--chandan)]' : 'border-[var(--line)] text-[var(--muted)]'
          }`}
        >
          <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--zendu)]" />
          <span>
            Festival phase: <strong>{phase.phase === 'during' ? `day ${phase.day} of ${phase.totalDays}${phase.isVisarjan ? ', visarjan' : ''}` : phase.phase}</strong>.{' '}
            {explain.dwellCounted
              ? 'CROWD_DWELL_PUBLIC is ON — dwell is weighing on live colours.'
              : 'CROWD_DWELL_PUBLIC is off — dwell columns show what it would do; live colours ignore it.'}
          </span>
        </p>

        {/* ---------------- The rules ---------------- */}
        <details className="mt-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4" open>
          <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            The rules, in order
          </summary>
          <pre className="mt-3 overflow-x-auto font-mono text-[11.5px] leading-[1.8] text-[var(--muted)]">
{`PHASE 0 — MEASURED (human reports)
  report mass  = 2^(-age/${FRESHNESS_HALF_LIFE_MINUTES})  ×  (1.0 at the gate | ${OFFSITE_WEIGHT} off-site)
  window       = ${ACTIVE_WINDOW_MINUTES} min — older reports score 0
  device gate  = at least ${MIN_DEVICES_FOR_STATUS} distinct devices, or no colour at all

PHASE 2 — DWELL (only if CROWD_DWELL_PUBLIC)
  dwell mass   = 2^(-age/${FRESHNESS_HALF_LIFE_MINUTES})  ×  ${DWELL_MASS}      queueing → red, lingering → yellow
  cap          = ${DWELL_MASS_CAP} total per mandal; earns no device credit

COLOUR
  score[level] = sum of report mass + dwell mass for that level
  winner       = the level with the highest score (tie → newest report)
  agreement    = score[winner] ÷ total score
  confidence   = low  if human mass < 2 or agreement < 0.5
                 high if human mass ≥ 6 and agreement ≥ 0.7
                 else medium                (dwell never raises it)

PHASE 1 — USUALLY (only where nobody reported)
  load  = hourFactor(IST hour) × min(1, festival-day factor + weekend bonus)
  quiet = normal wait × ${QUIET_FRACTION}
  wait  = quiet + load × (peak wait − quiet)
  level = wait ≥ ${LONG_THRESHOLD_MIN} → red · wait ≥ ${SHORT_THRESHOLD_MIN} → yellow · else green`}
          </pre>
        </details>

        {/* ---------------- Per mandal ---------------- */}
        <div className="mt-6 flex flex-col gap-3">
          {rows.map(({ mandalId, g, status, humanOnly, breakdown: b, devices, prior, decision }) => {
            const winner = status.status;
            const agreement = winner && b.mass > 0 ? b.scores[winner] / b.mass : 0;
            const hollow = !decision.onMapAndBadges;

            return (
              <section
                key={mandalId}
                className="rounded-[var(--radius-card)] border border-[var(--line-strong)] bg-[var(--dhoop)] p-4"
              >
                {/* Header: mandal, what visitors see, which rule */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--chandan)]">
                    <Swatch level={decision.level} hollow={hollow} />
                    {g?.name ?? mandalId}
                  </h2>
                  <span
                    className="rounded-[var(--radius-chip)] border px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      borderColor: decision.decider === 'dwell-tipped' ? 'var(--zendu)' : 'var(--line-strong)',
                      color: decision.decider === 'dwell-tipped' ? 'var(--zendu)' : 'var(--muted)',
                    }}
                  >
                    {DECIDER[decision.decider].label}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                  Visitors see:{' '}
                  <strong style={{ color: decision.level ? COLOR[decision.level] : 'var(--faint)' }}>
                    {decision.level ? WORD[decision.level] : 'no colour'}
                  </strong>
                  {decision.level && !decision.onMapAndBadges && ' (panel only, "Usually")'}
                  {' — '}
                  {DECIDER[decision.decider].note}
                </p>

                {/* ---- Phase 0 / 2: the scores ---- */}
                {b.mass > 0 && (
                  <div className="mt-3 border-t border-[var(--line)] pt-3">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
                      {(['short', 'moving', 'long'] as CrowdLevel[]).map((l) => (
                        <span key={l} style={{ width: `${(b.scores[l] / b.mass) * 100}%`, background: COLOR[l] }} />
                      ))}
                    </div>

                    <table className="mt-2.5 w-full border-collapse font-mono text-[11.5px]">
                      <tbody>
                        {(['short', 'moving', 'long'] as CrowdLevel[]).map((l) => {
                          const human = b.reports.filter((r) => r.status === l).reduce((s, r) => s + r.mass, 0);
                          const dwell = b.dwell.filter((d) => d.level === l).reduce((s, d) => s + d.mass, 0);
                          return (
                            <tr key={l} className={winner === l ? 'text-[var(--chandan)]' : 'text-[var(--muted)]'}>
                              <td className="py-0.5" style={{ color: COLOR[l] }}>{l}</td>
                              <td className="py-0.5">human {n3(human)}</td>
                              <td className="py-0.5">+ dwell {n3(dwell)}</td>
                              <td className="py-0.5">= {n3(b.scores[l])}</td>
                              <td className="py-0.5">{winner === l ? '← winner' : ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <p className="mt-2 font-mono text-[11.5px] leading-[1.7] text-[var(--muted)]">
                      devices {devices} (need {MIN_DEVICES_FOR_STATUS}) → {devices >= MIN_DEVICES_FOR_STATUS ? 'gate passed' : 'gate FAILED, no colour'}
                      <br />
                      human mass {n3(b.humanMass)} · total {n3(b.mass)} · agreement {n3(agreement)} → confidence{' '}
                      <span className="text-[var(--chandan)]">{status.confidence}</span>
                      {b.dwell.length > 0 && (
                        <>
                          <br />
                          dwell raw {n3(b.dwellMassRaw)} → applied {n3(b.dwellMassApplied)}
                          {b.dwellScale < 1 && ` (cap ×${n3(b.dwellScale)})`}
                          {' · '}humans alone would show{' '}
                          <span style={{ color: humanOnly.status ? COLOR[humanOnly.status] : 'var(--faint)' }}>
                            {humanOnly.status ?? 'no colour'}
                          </span>
                        </>
                      )}
                    </p>

                    {b.reports.length > 0 && (
                      <table className="mt-3 w-full border-collapse font-mono text-[11.5px]">
                        <thead>
                          <tr className="text-left text-[var(--faint)]">
                            <th className="py-1 font-normal">report</th>
                            <th className="py-1 font-normal">age</th>
                            <th className="py-1 font-normal">2^(-age/30)</th>
                            <th className="py-1 font-normal">× where</th>
                            <th className="py-1 font-normal">= mass</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.reports.map((r, i) => (
                            <tr key={i} className="border-t border-[var(--line)]">
                              <td className="py-1" style={{ color: COLOR[r.status] }}>{r.status}</td>
                              <td className="py-1 text-[var(--muted)]">{r.ageMinutes.toFixed(0)}m</td>
                              <td className="py-1 text-[var(--muted)]">{n3(r.freshness)}</td>
                              <td className="py-1 text-[var(--muted)]">{r.proximity} {r.atMandal ? 'gate' : 'off'}</td>
                              <td className="py-1 text-[var(--chandan)]">{n3(r.mass)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {b.dwell.length > 0 && (
                      <table className="mt-3 w-full border-collapse font-mono text-[11.5px]">
                        <thead>
                          <tr className="text-left text-[var(--faint)]">
                            <th className="py-1 font-normal">dwell</th>
                            <th className="py-1 font-normal">→</th>
                            <th className="py-1 font-normal">age</th>
                            <th className="py-1 font-normal">0.25×fresh</th>
                            <th className="py-1 font-normal">after cap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.dwell.map((d, i) => (
                            <tr key={i} className="border-t border-[var(--line)]">
                              <td className="py-1 text-[var(--zendu)]">{d.dwell}</td>
                              <td className="py-1" style={{ color: COLOR[d.level] }}>{d.level}</td>
                              <td className="py-1 text-[var(--muted)]">{d.ageMinutes.toFixed(0)}m</td>
                              <td className="py-1 text-[var(--faint)]">{n3(d.rawMass)}</td>
                              <td className="py-1 text-[var(--chandan)]">{n3(d.mass)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* ---- Phase 1: the prior, whenever it is what visitors see ---- */}
                {prior && !status.status && (
                  <div className="mt-3 border-t border-[var(--line)] pt-3">
                    <p className="font-mono text-[11.5px] leading-[1.8] text-[var(--muted)]">
                      hourFactor({prior.workings.istHour.toFixed(2)} IST) = {n3(prior.workings.hourFactor)}
                      <br />
                      dayFactor = min(1, {n3(prior.workings.phaseFactor)} day {prior.workings.festivalDay} + {n3(prior.workings.weekendBonus)} weekend) = {n3(prior.workings.dayFactor)}
                      <br />
                      load = {n3(prior.workings.hourFactor)} × {n3(prior.workings.dayFactor)} = {n3(prior.workings.load)}
                      <br />
                      quiet = {prior.workings.normalMinutes} × {QUIET_FRACTION} = {prior.workings.quietMinutes.toFixed(1)} min
                      <br />
                      wait = {prior.workings.quietMinutes.toFixed(1)} + {n3(prior.workings.load)} × ({prior.workings.peakMinutes} − {prior.workings.quietMinutes.toFixed(1)}) ≈{' '}
                      <span className="text-[var(--chandan)]">{prior.waitMinutes} min</span>
                      {' → '}
                      <span style={{ color: COLOR[prior.level] }}>{WORD[prior.level]}</span>
                      <br />
                      <span className="text-[var(--faint)]">
                        wait figures: {prior.basis}
                        {prior.basis === 'estimated' ? ' (no curated wait times — capped below red by design)' : ''}
                      </span>
                    </p>
                  </div>
                )}

                {!prior && !status.status && status.reportCount === 0 && (
                  <p className="mt-2 text-[12px] text-[var(--faint)]">
                    No reports, no dwell, and the prior is silent at this moment.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
