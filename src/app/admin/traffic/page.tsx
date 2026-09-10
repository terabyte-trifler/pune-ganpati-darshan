import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Globe, MapPin, Share2 } from 'lucide-react';
import { getSessionUser } from '@/services/auth';
import { getTrafficOverview } from '@/services/traffic-admin';

export const metadata = { title: 'Traffic', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Where the traffic comes from.
 *
 * The app has recorded analytics events since the first commit and nothing
 * ever read them back. This is the reading surface.
 *
 * Everything here is counted by SESSIONS, not events. Event counts flatter
 * whoever browsed the most, so one enthusiastic person looks like a city;
 * sessions answer the question actually being asked, which is how many
 * people, from where.
 *
 * City is the finest grain stored. Latitude, longitude and postal code
 * arrive on every request from Vercel and are deliberately discarded at
 * ingest — see the traffic_origin migration for where that line is drawn
 * and why.
 */

const WINDOW_DAYS = 7;

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]"
      role="presentation"
    >
      <div className="h-full rounded-full bg-[var(--shendur)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  rows,
  empty,
}: {
  title: string;
  icon: typeof Globe;
  rows: { label: string; sub?: string | null; value: number }[];
  empty: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);

  return (
    <section className="surface rounded-[var(--radius-card)] border border-[var(--line)] p-4">
      <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
        <Icon size={13} aria-hidden="true" />
        {title}
      </h2>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={`${r.label}-${r.sub ?? ''}`} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[14px] text-[var(--chandan)]">
                  {r.label}
                  {r.sub && (
                    <span className="ml-1.5 text-[12px] text-[var(--faint)]">{r.sub}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[13px] tabular-nums text-[var(--zendu)]">
                  {r.value.toLocaleString('en-IN')}
                </span>
              </div>
              <Bar value={r.value} max={max} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminTrafficPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/traffic');
  if (!user.isAdmin) redirect('/');

  const overview = await getTrafficOverview(WINDOW_DAYS);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Admin
        </Link>

        <h1 className="font-display mt-3 text-[30px] font-bold text-[var(--chandan)]">
          Traffic
        </h1>

        {overview === null ? (
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--muted)]">
            Analytics needs Supabase configured. Nothing is being recorded, so
            there is nothing to show — this is not an empty week.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Last {WINDOW_DAYS} days ·{' '}
              <span className="font-mono tabular-nums">
                {overview.sessions.toLocaleString('en-IN')}
              </span>{' '}
              sessions from{' '}
              <span className="font-mono tabular-nums">
                {overview.totalEvents.toLocaleString('en-IN')}
              </span>{' '}
              events
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <Panel
                title={`Cities · last ${WINDOW_DAYS} days`}
                icon={MapPin}
                empty="No located sessions yet. Vercel's geolocation headers are absent in local development, so city only fills in from production traffic."
                rows={overview.cities.map((c) => ({
                  label: c.city,
                  sub: [c.region, c.country].filter(Boolean).join(', ') || null,
                  value: c.sessions,
                }))}
              />

              <Panel
                title="Countries"
                icon={Globe}
                empty="No countries recorded yet."
                rows={overview.countries.map((c) => ({
                  label: c.country,
                  value: c.sessions,
                }))}
              />

              <Panel
                title="Arrived from"
                icon={Share2}
                empty="No referrers recorded yet."
                rows={overview.referrers.map((r) => ({
                  label: r.source,
                  value: r.sessions,
                }))}
              />

              {overview.daily.length > 0 && (
                <section className="surface rounded-[var(--radius-card)] border border-[var(--line)] p-4">
                  <h2 className="text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
                    Sessions per day
                  </h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {overview.daily.map((d) => {
                      const max = overview.daily.reduce(
                        (m, x) => Math.max(m, x.sessions),
                        0
                      );
                      return (
                        <li key={d.day} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 font-mono text-[12px] text-[var(--faint)]">
                            {d.day}
                          </span>
                          <span className="flex-1">
                            <Bar value={d.sessions} max={max} />
                          </span>
                          <span className="w-12 shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--chandan)]">
                            {d.sessions}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>

            <p className="mt-5 text-[12px] leading-relaxed text-[var(--faint)]">
              Counted by sessions, not events, so one person browsing a lot does
              not read as a city. Origin is resolved by Vercel from the
              requester&rsquo;s IP before the request reaches the app; city is the
              finest grain stored — no coordinates, no postal code, and the IP
              itself is never recorded. &ldquo;Arrived from&rdquo; is the referring
              host only, never a full URL.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
