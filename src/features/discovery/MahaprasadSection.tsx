import { Navigation, HandPlatter, Info } from 'lucide-react';
import { SectionHeader } from '@/features/discovery/SectionHeader';
import { MAHAPRASAD, mahaprasadDirections } from '@/content/mahaprasad';

/**
 * Where mahaprasad is being served.
 *
 * Renders nothing when the list is empty. That is deliberate and worth
 * stating: a mahaprasad section with invented timings is worse than no
 * section, because the cost of being wrong is somebody elderly walking
 * across the peths to a counter that is not serving.
 *
 * Standalone — no catalogue join, no mandal page. Serving food is not the
 * same claim as being a darshan destination, so an entry here needs only
 * a name, a place and what was announced. See content/mahaprasad.
 *
 * Every line on a card is what a mandal said. The app adds the caveat at
 * the bottom and nothing else.
 */
export function MahaprasadSection() {
  if (MAHAPRASAD.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHeader title="Mahaprasad" titleMr="महाप्रसाद" />

      <ul className="space-y-2 px-4">
        {MAHAPRASAD.map((entry) => (
          <li
            key={entry.name}
            /* A one-off olive accent, not --tulsi: globals.css reserves
               that green for success and verified states only. */
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4"
          >
            <div className="flex items-start gap-3">
              {/* A hand offering a platter, which is how prasad is
                  actually given and received — on a leaf plate or thali,
                  by hand. It was a knife-and-fork icon, which is the
                  wrong register twice over: nobody eats prasad with
                  cutlery, and the association is a restaurant rather
                  than an offering. */}
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#6F8F4A]/45"
              >
                <HandPlatter size={18} className="text-[#7FA355]" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[var(--chandan)]">
                  {entry.name}
                </p>
                {entry.nameMr && (
                  <p lang="mr" className="mt-0.5 text-[12px] text-[var(--muted)]">
                    {entry.nameMr}
                  </p>
                )}

                {/* The null is meaningful: the mandal serves but has not
                    announced a time. Never a placeholder hour. */}
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--chandan)]">
                  {entry.servesAt ?? 'Timings not announced'}
                  {entry.days && (
                    <span className="text-[var(--muted)]"> · {entry.days}</span>
                  )}
                </p>

                {entry.note && (
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                    {entry.note}
                  </p>
                )}

                <a
                  href={mahaprasadDirections(entry)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[#7FA355]"
                >
                  <Navigation size={13} aria-hidden="true" />
                  Directions
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* One caveat for the whole list rather than repeated on every card.
          It is the only sentence on this section the app wrote itself. */}
      <p className="mt-2.5 flex items-start gap-1.5 px-4 text-[11.5px] leading-relaxed text-[var(--faint)]">
        <Info size={11} aria-hidden="true" className="mt-0.5 shrink-0" />
        As announced by the mandals. Mahaprasad ends when it ends — this is
        not a live view of whether it is still being served.
      </p>
    </section>
  );
}
