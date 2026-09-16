import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/services/auth';
import { getTrafficOverview } from '@/services/traffic-admin';
import { TrafficReport } from '@/features/admin/TrafficReport';
import { scaleOverview, SAMPLE_SESSIONS } from '@/services/traffic-sample';

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
 *
 * "Which part of Pune" is answered by the two peth panels rather than by
 * geography, because IP geolocation genuinely cannot answer it: the city
 * header says "Pune" and no more, and Indian mobile carriers route
 * through regional gateways that make it worse still. The two panels
 * measure different things and are kept apart on purpose — one is what
 * people look at, the other is where they physically stood. Averaging
 * them would produce a number that describes neither.
 */

const WINDOW_DAYS = 7;

export default async function AdminTrafficPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/traffic');
  if (!user.isAdmin) redirect('/');

  /**
   * ?preview=scale draws the same week at festival scale.
   *
   * For checking the layout holds when the counts run to five figures.
   * Off unless asked for, and it says so on the page — a traffic report
   * that can be mistaken for a measurement is worse than no report.
   */
  const preview = (await searchParams).preview === 'scale';
  const real = await getTrafficOverview(WINDOW_DAYS);
  const overview = preview && real ? scaleOverview(real) : real;

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

        {preview && (
          <p
            className="mt-3 rounded-[10px] border border-[var(--shendur)]/45 bg-[var(--shendur)]/10 px-3 py-2 text-[12.5px] leading-relaxed text-[var(--chandan)]"
            role="status"
          >
            <strong className="font-bold">Layout preview — not real traffic.</strong>{' '}
            The recorded week, multiplied to {SAMPLE_SESSIONS.toLocaleString('en-IN')}{' '}
            sessions so the panels can be read at festival scale. The cities and
            peths are the ones actually recorded; only the size is invented.{' '}
            <Link href="/admin/traffic" className="underline">
              Show the real week
            </Link>
          </p>
        )}

        <TrafficReport overview={overview} windowDays={WINDOW_DAYS} />
      </div>
    </main>
  );
}
