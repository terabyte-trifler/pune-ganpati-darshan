import { Globe, MapPin, Share2, Landmark, Footprints } from 'lucide-react';
import type { TrafficOverview } from '@/services/traffic-admin';

/**
 * The traffic report itself, with no idea who is allowed to see it.
 *
 * Split out from the admin page so the page is left holding the two things
 * only it can do — check the session and choose which overview to render —
 * and so the panels can be rendered against a given overview without a
 * database or a signed-in administrator. That is what makes it possible to
 * look at the layout at a scale the recorded week has not reached.
 */
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

export function TrafficReport({
  overview,
  windowDays,
}: {
  overview: TrafficOverview | null;
  windowDays: number;
}) {
  const WINDOW_DAYS = windowDays;
  return (
    <>
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
            title="Peths by interest"
            icon={Landmark}
            empty="No mandal views recorded in this window."
            rows={overview.pethInterest.map((p) => ({
              label: p.peth,
              sub: `${p.views.toLocaleString('en-IN')} views`,
              value: p.sessions,
            }))}
          />

          <Panel
            title={
              overview.onsiteShare === null
                ? 'Peths by on-site reports'
                : `Peths by on-site reports · ${overview.onsiteShare}% of reports were on site`
            }
            icon={Footprints}
            empty="No on-site reports in this window. Only reports submitted within ~100m of a mandal count here, so this fills in once people report while they are actually out."
            rows={overview.pethPresence.map((p) => ({
              label: p.peth,
              sub: `${p.devices.toLocaleString('en-IN')} devices`,
              value: p.reports,
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
                      {/*
                        Grouped like every other count on the page, and
                        given room for five figures. This printed the raw
                        number in a 48px column — fine at 194, and the one
                        number here that would have read "7946" on a
                        festival night while the panel above it said
                        "13,890".
                      */}
                      <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--chandan)]">
                        {d.sessions.toLocaleString('en-IN')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <p className="mt-5 text-[12px] leading-relaxed text-[var(--faint)]">
          <strong className="text-[var(--muted)]">Which part of Pune:</strong>{' '}
          geolocation cannot tell you — the city header says
          &ldquo;Pune&rdquo; and no more, and Indian mobile carriers route
          through regional gateways that blur it further. So the two peth
          panels answer it instead, from data already collected:{' '}
          <em>interest</em> is which mandals people opened,{' '}
          <em>on-site reports</em> is where they were physically standing
          when they reported, within about 100m. The second is the stronger
          signal but covers only people who reported. The visitor&rsquo;s GPS
          position is never used for either — that permission was granted to
          show what is nearby, not to be counted.
          <br /><br />
          Counted by sessions, not events, so one person browsing a lot does
          not read as a city. Origin is resolved by Vercel from the
          requester&rsquo;s IP before the request reaches the app; city is the
          finest grain stored — no coordinates, no postal code, and the IP
          itself is never recorded. &ldquo;Arrived from&rdquo; is the referring
          host only, never a full URL.
        </p>
      </>
    )}

    </>
  );
}
