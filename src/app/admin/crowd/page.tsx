import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowLeft, ShieldAlert } from 'lucide-react';
import { getSessionUser } from '@/services/auth';
import { getAllGanpatis } from '@/services/ganpati';
import {
  getCrowdAdminOverview,
  listDeviceBlocks,
} from '@/services/crowd/crowd-admin';
import { readCrowdMetrics } from '@/services/crowd/crowd-metrics';
import { getCrowdSnapshot } from '@/services/crowd/crowd-service';
import { MandalReportingToggle, DeviceBlockControls } from '@/features/admin/CrowdControls';
import type { CrowdStatus } from '@/types/crowd';

export const metadata = { title: 'Crowd analytics', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Crowd analytics and abuse controls (§57, §58).
 *
 * Device identifiers are shown as a short digest rather than in full.
 * They are anonymous already, but an admin screen that prints raw ids
 * invites them into screenshots and tickets, and nothing here needs the
 * whole value to be legible — blocking passes it through without a human
 * reading it.
 */
export default async function AdminCrowdPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/crowd');
  if (!user.isAdmin) redirect('/');

  const [overview, ganpatis, blocks, metrics] = await Promise.all([
    getCrowdAdminOverview(),
    getAllGanpatis(),
    listDeviceBlocks(),
    Promise.resolve(readCrowdMetrics()),
  ]);

  let snapshot: CrowdStatus[] = [];
  try {
    snapshot = (await getCrowdSnapshot()).statuses;
  } catch {
    // The console must still render when the crowd read path is down —
    // that is exactly when someone opens it.
  }

  const nameById = new Map(ganpatis.map((g) => [g.id, g.name]));
  const reported = snapshot
    .filter((s) => s.reportCount > 0)
    .sort((a, b) => b.reportCount - a.reportCount);

  const stat = (label: string, value: number | string) => (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-3">
      <dt className="text-[12px] uppercase tracking-wide text-[var(--faint)]">{label}</dt>
      <dd className="mt-1 text-[20px] font-bold text-[var(--chandan)]">{value}</dd>
    </div>
  );

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Admin
      </Link>

      <h1 className="mt-3 flex items-center gap-2 text-[24px] font-extrabold tracking-tight text-[var(--chandan)]">
        <Activity size={20} aria-hidden="true" className="text-[var(--shendur)]" />
        Crowd analytics
      </h1>

      {!overview ? (
        <p className="mt-4 text-[14px] text-[var(--muted)]">
          Crowd reporting is not configured on this deployment.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stat('Today', overview.reportsToday)}
            {stat('Last hour', overview.reportsLastHour)}
            {stat('Last 15 min', overview.reportsLast15Min)}
            {stat('Active mandals', overview.activeMandals)}
            {stat('Active devices', overview.activeDevices)}
          </dl>

          {/* ---------------- Cache health ---------------- */}
          <section className="mt-7">
            <h2 className="text-[15px] font-bold text-[var(--chandan)]">
              This instance
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--faint)]">
              In-process counters since this server started
              {' '}({metrics.uptimeSeconds}s ago). Per-instance, not cluster-wide.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stat(
                'Cache hit ratio',
                metrics.cacheHitRatio === null
                  ? '—'
                  : `${(metrics.cacheHitRatio * 100).toFixed(1)}%`
              )}
              {stat('DB queries', metrics.latency.crowd_db_latency?.count ?? 0)}
              {stat(
                'API p95',
                metrics.latency.crowd_api_latency
                  ? `${metrics.latency.crowd_api_latency.p95}ms`
                  : '—'
              )}
              {stat(
                'DB p95',
                metrics.latency.crowd_db_latency
                  ? `${metrics.latency.crowd_db_latency.p95}ms`
                  : '—'
              )}
            </dl>
          </section>

          {/* ---------------- Most crowded right now ---------------- */}
          <section className="mt-7">
            <h2 className="text-[15px] font-bold text-[var(--chandan)]">
              Crowd right now
            </h2>
            {reported.length === 0 ? (
              <p className="mt-2 text-[13px] text-[var(--muted)]">
                No mandal has an active report.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]">
                {reported.map((s) => (
                  <li key={s.mandalId} className="flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--chandan)]">
                      {nameById.get(s.mandalId) ?? s.mandalId}
                    </span>
                    <span className="shrink-0 text-[13px] text-[var(--muted)]">
                      {s.label} · {s.reportCount} · {s.confidence} · {s.trend}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------- Suspicious patterns ---------------- */}
          <section className="mt-7">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--chandan)]">
              <ShieldAlert size={16} aria-hidden="true" className="text-[var(--zendu)]" />
              Suspicious patterns (24h)
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--faint)]">
              Recorded, not acted on. A burst of reports is more often a group of
              friends than an attacker — review before blocking.
            </p>
            {overview.openSignals.length === 0 ? (
              <p className="mt-2 text-[13px] text-[var(--muted)]">Nothing flagged.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]">
                {overview.openSignals.map((signal) => (
                  <li
                    key={`${signal.device_digest}-${signal.signal}`}
                    className="flex flex-wrap items-center gap-3 p-3"
                  >
                    <span className="font-mono text-[12px] text-[var(--faint)]">
                      {signal.device_digest}
                    </span>
                    <span className="text-[13px] text-[var(--chandan)]">
                      {signal.signal.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[12px] text-[var(--muted)]">
                      ×{signal.occurrences}
                    </span>
                    <DeviceBlockControls
                      deviceId={signal.device_id}
                      digest={signal.device_digest}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------- Blocked devices ---------------- */}
          {blocks.length > 0 && (
            <section className="mt-7">
              <h2 className="text-[15px] font-bold text-[var(--chandan)]">
                Blocked devices
              </h2>
              <ul className="mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]">
                {blocks.map((block) => (
                  <li key={block.device_id} className="flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--muted)]">
                      {block.reason}
                    </span>
                    <DeviceBlockControls deviceId={block.device_id} blocked />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---------------- Per-mandal reporting ---------------- */}
          <section className="mt-7">
            <h2 className="text-[15px] font-bold text-[var(--chandan)]">
              Reporting per mandal
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--faint)]">
              Turn reporting off for a mandal that is being brigaded, or where a
              crowd reading could send people somewhere unsafe.
            </p>
            <ul className="mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]">
              {ganpatis.map((g) => (
                <li key={g.id} className="flex items-center gap-3 p-3">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--chandan)]">
                    {g.name}
                  </span>
                  <MandalReportingToggle
                    mandalId={g.id}
                    enabled={g.crowdReportingEnabled}
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
