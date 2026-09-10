import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllGanpatis } from '@/services/ganpati';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Data sources and licences',
  description:
    'Where the map, coordinates and mandal information on Pune Ganpati Darshan come from, and under what licences.',
  alternates: { canonical: '/licences' },
};

export const revalidate = 3600;

/**
 * Attribution page.
 *
 * OpenStreetMap data carries a licence condition even when no photographs are
 * used, so this page stays regardless: the map tiles, several coordinates and
 * the routing all derive from OSM.
 */
export default async function LicencesPage() {
  const ganpatis = await getAllGanpatis();
  const fromOsm = ganpatis.filter((g) => g.coordinateSource === 'openstreetmap');
  const withPhotos = ganpatis.filter((g) => g.images.length > 0);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <h1 className="font-display text-[30px] font-bold text-[var(--chandan)]">
          Data sources
        </h1>

        <section className="mt-6">
          <h2 className="text-[17px] font-bold text-[var(--chandan)]">Map and routing</h2>
          <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-[var(--muted)]">
            <p>
              Map tiles are served by{' '}
              <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer"
                 className="text-[var(--shendur)] underline">OpenFreeMap</a>{' '}
              from{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
                 className="text-[var(--shendur)] underline">OpenStreetMap</a>{' '}
              data, licensed under the{' '}
              <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer"
                 className="text-[var(--shendur)] underline">Open Database Licence</a>.
              The dark styling is this project&rsquo;s own.
            </p>
            <p>
              Walking routes are computed by{' '}
              <a href="https://project-osrm.org" target="_blank" rel="noopener noreferrer"
                 className="text-[var(--shendur)] underline">OSRM</a>, also over
              OpenStreetMap data.
            </p>
          </div>
        </section>

        <section className="mt-7">
          <h2 className="text-[17px] font-bold text-[var(--chandan)]">Mandal coordinates</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
            {fromOsm.length} of {ganpatis.length} mandal locations come from named
            OpenStreetMap features and record the element id they were taken
            from, so anyone can re-check them. The rest are compiled from
            community information and are accurate to the lane rather than the
            doorway — which is why each mandal page says which it is.
          </p>
          {fromOsm.length > 0 && (
            <ul className="mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]">
              {fromOsm.map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-3 p-3">
                  <Link href={`/ganpati/${g.slug}`} className="text-[14px] text-[var(--chandan)]">
                    {g.name}
                  </Link>
                  <span className="shrink-0 font-mono text-[12px] text-[var(--faint)]">
                    {g.osmId}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-7">
          <h2 className="text-[17px] font-bold text-[var(--chandan)]">Photographs</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
            {withPhotos.length === 0 ? (
              <>
                This site uses no photographs of the mandals. Each one is shown
                with a drawn Ganpati mark instead — an illustration is plainly
                not a picture of that mandal, whereas a borrowed or generic
                photo would imply something untrue about a real place.
              </>
            ) : (
              <>
                {withPhotos.reduce((n, g) => n + g.images.length, 0)} photographs
                are used, each credited to its photographer on the mandal&rsquo;s
                own page.
              </>
            )}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--faint)]">
            If you are a mandal and would like your own photographs shown here,
            please get in touch.
          </p>
        </section>

        <section className="mt-7">
          <h2 className="text-[17px] font-bold text-[var(--chandan)]">Mandal information</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
            Descriptions, history and queue estimates are compiled from
            community knowledge and are marked as verified or community
            information on each page. Darshan timings are deliberately not
            published: mandals announce them close to the festival, and a
            confident wrong time sends someone across the city for nothing.
          </p>
        </section>
      </div>
      <SiteFooter className="mx-auto mt-10 max-w-2xl px-4" />
    </main>
  );
}
