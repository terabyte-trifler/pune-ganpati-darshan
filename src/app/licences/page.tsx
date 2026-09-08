import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllGanpatis } from '@/services/ganpati';

export const metadata: Metadata = {
  title: 'Photo credits and licences',
  description:
    'Photographers and Creative Commons licences for every photograph used on Pune Ganpati Darshan.',
  alternates: { canonical: '/licences' },
};

export const revalidate = 3600;

/**
 * Attribution page.
 *
 * CC BY-SA requires attribution, a link to the licence, and an indication of
 * changes made. This page carries all three for every photograph, which is
 * what makes using them lawful.
 */
export default async function LicencesPage() {
  const ganpatis = await getAllGanpatis();
  const withPhotos = ganpatis.filter((g) => g.images.length > 0);
  const photoCount = withPhotos.reduce((n, g) => n + g.images.length, 0);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--chandan)]">
          Photo credits
        </h1>

        <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-[var(--muted)]">
          <p>
            The {photoCount} photographs on this site come from{' '}
            <a
              href="https://commons.wikimedia.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--shendur)] underline"
            >
              Wikimedia Commons
            </a>{' '}
            under Creative Commons licences, and are credited to their
            photographers below.
          </p>
          <p>
            <strong className="text-[var(--chandan)]">Changes made:</strong>{' '}
            each image was resized to at most 1400px wide and recompressed as
            JPEG. Nothing else was altered.
          </p>
          <p>
            Licence terms:{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-[var(--shendur)] underline">CC BY-SA 4.0</a>{' · '}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer" className="text-[var(--shendur)] underline">CC BY-SA 3.0</a>{' · '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-[var(--shendur)] underline">CC BY 4.0</a>
          </p>
          <p className="text-[13px] text-[var(--faint)]">
            {ganpatis.length - withPhotos.length} of {ganpatis.length} mandals
            have no freely-licensed photograph available. Rather than use a
            generic image and imply it shows that mandal, those entries use a
            generated placeholder.
          </p>
        </div>

        <ul className="mt-7 divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]">
          {withPhotos.map((g) => (
            <li key={g.id} className="p-3.5">
              <Link
                href={`/ganpati/${g.slug}`}
                className="text-[14px] font-semibold text-[var(--chandan)]"
              >
                {g.name}
              </Link>
              <ul className="mt-1 space-y-0.5">
                {g.images.map((image) => (
                  <li key={image.id} className="text-[12px] text-[var(--muted)]">
                    {image.credit ?? 'Credit unavailable'}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-[12px] leading-relaxed text-[var(--faint)]">
          If you are a photographer or mandal and want an image removed or
          credited differently, please get in touch and it will be changed.
        </p>
      </div>
    </main>
  );
}
