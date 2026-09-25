import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllGanpatis, getAreas, getFestivalConfig } from '@/services/ganpati';
import { isVisarjanImminent } from '@/lib/festival';
import { MapView } from '@/features/map/MapView';
import { VisarjanMapControls } from '@/features/visarjan/VisarjanMapControls';
import { VisarjanMapKey } from '@/features/visarjan/VisarjanMapKey';
import { VISARJAN_GEOMETRY } from '@/content/visarjan-geometry';

export const metadata: Metadata = {
  title: 'Map',
  description:
    'Every Pune Ganpati mandal on one map — filter by area, find what is near you, and open directions.',
  alternates: { canonical: '/map' },
};

export const revalidate = 3600;

export default async function MapPage() {
  const [ganpatis, areas, festival] = await Promise.all([
    getAllGanpatis(),
    getAreas(),
    getFestivalConfig(),
  ]);

  const visarjan = isVisarjanImminent(festival);

  /**
   * On Anant Chaturdashi this route draws the visarjan map itself — the
   * same component /visarjan uses, not a second rendering of the same
   * idea.
   *
   * The alternative was to keep the ordinary map and swap its layers,
   * which is what this did for an hour, and it left the two maps
   * disagreeing in ways a reader would notice: one drew mandals in
   * bhagwa and one in queue colours, one had a key describing a plan it
   * was no longer drawing, one could be opened full screen and one
   * could not. Rendering the same component means there is one visarjan
   * map on the site and both routes lead to it.
   *
   * The filters, the area picker and the bottom sheet go for the day.
   * They sort mandals by area and by queue, which is the question the
   * ordinary festival asks; today the question is where the procession
   * is and which roads are shut, and every one of those controls would
   * be filtering a map that has stopped being about mandals.
   */
  if (visarjan) {
    const frame = VISARJAN_GEOMETRY.flatMap((g) =>
      g.segments.flat().map(([lng, lat]) => ({ lat, lng }))
    );

    return (
      <main id="main" className="pb-nav md:pb-10">
        <div className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+20px)]">
          <h1 className="font-display text-[26px] font-bold leading-tight text-[var(--chandan)]">
            Visarjan day map
          </h1>
          <p className="prose-measure mt-2 text-[15px] leading-[1.7] text-[var(--muted)]">
            The procession&rsquo;s corridor, the roads that close and when,
            where you will be turned around, and the places the police name
            for parking today. The mandal filters are back tomorrow — today
            this map is about the miravnuk.
          </p>

          <VisarjanMapControls mandals={ganpatis} frameOn={frame} />

          <VisarjanMapKey mandalCount={ganpatis.length} />

          <Link
            href="/visarjan"
            className="mt-4 inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--shendur)]"
          >
            Timings, closures and the live tracker →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main">
      <h1 className="sr-only">Map of Pune Ganpati mandals</h1>
      <MapView ganpatis={ganpatis} areas={areas} />
    </main>
  );
}
