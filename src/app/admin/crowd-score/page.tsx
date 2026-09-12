import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sigma, TriangleAlert } from 'lucide-react';
import { getSessionUser } from '@/services/auth';
import { getAllGanpatis, getFestivalConfig } from '@/services/ganpati';
import { getFestivalPhase } from '@/lib/festival';
import { getCrowdExplain } from '@/services/crowd/crowd-service';
import { crowdExpectation } from '@/services/crowd/crowd-prior';
import {
  MIN_DEVICES_FOR_STATUS, ACTIVE_WINDOW_MINUTES, FRESHNESS_HALF_LIFE_MINUTES,
  OFFSITE_WEIGHT, DWELL_MASS, DWELL_MASS_CAP,
} from '@/services/crowd/crowd-aggregation';
import type { CrowdLevel } from '@/types/crowd';

export const metadata = { title: 'Crowd score', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Why each mandal is the colour it is.
 *
 * Every number on this page comes from the same `scoreBreakdown` the live
 * API calls — not a reimplementation. An explainer that recomputes the
 * answer separately can disagree with the page it explains, and the
 * disagreement is invisible until somebody trusts the wrong one.
 *
 * It shows all three lanes at once, which nothing else does:
 *
 *   Lane A  reports, each with its freshness and proximity factors
 *   Lane B  the prior, which speaks only where Lane A is silent
 *   Dwell   passive observations and their capped contribution
 *
 * Dwell is shown even when CROWD_DWELL_PUBLIC is off, so its effect can
 * be inspected before it is switched on. The banner says which.
 */

const COLOR: Record<CrowdLevel, string> = {
  short: 'var(--crowd-short)',
  moving: 'var(--crowd-moving)',
  long: 'var(--crowd-long)',
};

const n3 = (v: number) => v.toFixed(3);

function Bar({ scores, mass }: { scores: Record<CrowdLevel, number>; mass: number }) {
  if (mass <= 0) return null;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
      {(['short', 'moving', 'long'] as CrowdLevel[]).map((l) => (
        <span
          key={l}
          style={{ width: `${(scores[l] / mass) * 100}%`, background: COLOR[l] }}
        />
      ))}
    </div>
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
        <p className="text-[14px] text-[var(--muted)]">
          Crowd data is unreachable, so there is nothing to explain.
        </p>
      </main>
    );
  }

  // Loudest first: a mandal with evidence is what someone opens this for.
  const rows = [...explain.mandals].sort(
    (a, b) => b.breakdown.mass - a.breakdown.mass
  );
  const withEvidence = rows.filter((r) => r.breakdown.mass > 0);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-4xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--muted)]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Admin
        </Link>

        <h1 className="font-display mt-2 flex items-center gap-2 text-[26px] font-bold text-[var(--chandan)]">
          <Sigma size={20} aria-hidden="true" className="text-[var(--shendur)]" />
          Crowd score
        </h1>
        <p className="prose-measure mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
          Why every mandal is the colour it is, from the same code the live API
          runs. {withEvidence.length} of {rows.length} mandals have any evidence
          right now.
        </p>

        {/* ---------------- The rules, stated once ---------------- */}
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <pre className="overflow-x-auto font-mono text-[11.5px] leading-[1.75] text-[var(--muted)]">
{`report mass = 2^(-age/${FRESHNESS_HALF_LIFE_MINUTES})  ×  ${'{'} 1.0 at gate | ${OFFSITE_WEIGHT} off-site ${'}'}
dwell  mass = 2^(-age/${FRESHNESS_HALF_LIFE_MINUTES})  ×  ${DWELL_MASS}          capped at ${DWELL_MASS_CAP} in total
window      = ${ACTIVE_WINDOW_MINUTES} min; anything older scores zero
status shows only when distinct devices >= ${MIN_DEVICES_FOR_STATUS}   (dwell earns no device)
winner      = argmax(scores); confidence = f(HUMAN mass, agreement)`}
          </pre>
        </div>

        {/* ---------------- Dwell switch state ---------------- */}
        <p
          className={`mt-3 flex items-start gap-2 rounded-[var(--radius-field)] border px-3 py-2.5 text-[12.5px] leading-relaxed ${
            explain.dwellCounted
              ? 'border-[var(--shendur)]/40 text-[var(--chandan)]'
              : 'border-[var(--line)] text-[var(--muted)]'
          }`}
        >
          <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--zendu)]" />
          <span>
            {explain.dwellCounted ? (
              <>
                <strong>CROWD_DWELL_PUBLIC is ON.</strong> Dwell is weighing on
                the readings below and on the live site.
              </>
            ) : (
              <>
                <strong>CROWD_DWELL_PUBLIC is off.</strong> Dwell columns below
                show what it <em>would</em> contribute; the live status ignores
                it.
              </>
            )}
          </span>
        </p>

        {/* ---------------- Per mandal ---------------- */}
        <div className="mt-6 flex flex-col gap-3">
          {rows.map(({ mandalId, status, breakdown, devices }) => {
            const g = byId.get(mandalId);
            const b = breakdown;
            const prior = g
              ? crowdExpectation(
                  {
                    darshanMinutes: g.darshanMinutes,
                    peakDarshanMinutes: g.peakDarshanMinutes,
                    prominence: g.prominence,
                  },
                  phase,
                  now
                )
              : null;
            const quiet = b.mass === 0;

            return (
              <section
                key={mandalId}
                className={`rounded-[var(--radius-card)] border p-4 ${
                  quiet
                    ? 'border-[var(--line)] bg-transparent'
                    : 'border-[var(--line-strong)] bg-[var(--dhoop)]'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[15px] font-semibold text-[var(--chandan)]">
                    {g?.name ?? mandalId}
                  </h2>
                  <span className="flex items-center gap-2 text-[13px]">
                    {status.status ? (
                      <span className="font-bold" style={{ color: COLOR[status.status] }}>
                        {status.label}
                      </span>
                    ) : (
                      <span className="text-[var(--faint)]">{status.label}</span>
                    )}
                    <span className="font-mono text-[11px] text-[var(--faint)]">
                      {devices} dev · {status.confidence}
                    </span>
                  </span>
                </div>

                {quiet ? (
                  <p className="mt-1.5 text-[12px] text-[var(--faint)]">
                    No reports, no dwell.{' '}
                    {prior
                      ? `Lane B speaks: "${prior.label}" (~${prior.waitMinutes} min).`
                      : 'Lane B silent — outside the festival.'}
                  </p>
                ) : (
                  <>
                    <div className="mt-3">
                      <Bar scores={b.scores} mass={b.mass} />
                      <p className="mt-1.5 font-mono text-[11.5px] text-[var(--muted)]">
                        short {n3(b.scores.short)} · moving {n3(b.scores.moving)} ·
                        long {n3(b.scores.long)} &nbsp;|&nbsp; human {n3(b.humanMass)} ·
                        dwell {n3(b.dwellMassApplied)}
                        {b.dwellScale < 1 && (
                          <span className="text-[var(--zendu)]">
                            {' '}
                            (capped from {n3(b.dwellMassRaw)}, ×{n3(b.dwellScale)})
                          </span>
                        )}
                      </p>
                    </div>

                    {b.reports.length > 0 && (
                      <table className="mt-3 w-full border-collapse font-mono text-[11.5px]">
                        <thead>
                          <tr className="text-left text-[var(--faint)]">
                            <th className="py-1 font-normal">report</th>
                            <th className="py-1 font-normal">age</th>
                            <th className="py-1 font-normal">fresh</th>
                            <th className="py-1 font-normal">prox</th>
                            <th className="py-1 font-normal">mass</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.reports.map((r, i) => (
                            <tr key={i} className="border-t border-[var(--line)]">
                              <td className="py-1" style={{ color: COLOR[r.status] }}>{r.status}</td>
                              <td className="py-1 text-[var(--muted)]">{r.ageMinutes.toFixed(0)}m</td>
                              <td className="py-1 text-[var(--muted)]">{n3(r.freshness)}</td>
                              <td className="py-1 text-[var(--muted)]">
                                {r.proximity}
                                <span className="ml-1 text-[var(--faint)]">
                                  {r.atMandal ? 'gate' : 'off'}
                                </span>
                              </td>
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
                            <th className="py-1 font-normal">→ level</th>
                            <th className="py-1 font-normal">age</th>
                            <th className="py-1 font-normal">raw</th>
                            <th className="py-1 font-normal">applied</th>
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

                    {!status.status && (
                      <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--zendu)]">
                        No status shown: {devices} distinct device
                        {devices === 1 ? '' : 's'}, and{' '}
                        {MIN_DEVICES_FOR_STATUS} are required. Dwell cannot make
                        up the difference — it earns no device credit.
                        {prior && ` Lane B speaks instead: "${prior.label}".`}
                      </p>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
