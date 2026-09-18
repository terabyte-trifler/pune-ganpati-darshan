import Link from 'next/link';
import { ChevronRight, UtensilsCrossed, Info } from 'lucide-react';
import { SectionHeader } from '@/features/discovery/SectionHeader';
import { mahaprasadFor } from '@/content/mahaprasad';
import type { Ganpati } from '@/types/ganpati';

/**
 * Where mahaprasad is being served.
 *
 * Renders NOTHING when the list is empty, which is the state it ships in.
 * That is deliberate and worth stating: a mahaprasad section with invented
 * timings is worse than no section, because the cost of being wrong is
 * somebody elderly walking across the peths to a counter that is not
 * serving. An empty list means nobody has told us yet, and the honest
 * rendering of that is silence.
 *
 * Every line here comes from what a mandal announced. The app adds the
 * caveat and nothing else.
 */
export function MahaprasadSection({ ganpatis }: { ganpatis: Ganpati[] }) {
  const rows = mahaprasadFor(ganpatis);
  if (rows.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHeader title="Mahaprasad" titleMr="महाप्रसाद" />

      <ul className="space-y-2 px-4">
        {rows.map(({ ganpati, entry }) => (
          <li key={entry.slug}>
            <Link
              href={`/ganpati/${ganpati.slug}`}
              /* A one-off accent, not --tulsi: globals.css reserves that
                 green for success and verified states only, and this is
                 neither. Same approach the parking and photowalk cards
                 take — an olive that reads as food without borrowing a
                 colour that already means something else. */
              className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4 transition-colors hover:border-[#6F8F4A]/60"
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#6F8F4A]/45"
              >
                <UtensilsCrossed size={18} className="text-[#7FA355]" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-[var(--chandan)]">
                  {ganpati.name}
                </span>
                {ganpati.nameMr && (
                  <span lang="mr" className="mt-0.5 block text-[12px] text-[var(--muted)]">
                    {ganpati.nameMr}
                  </span>
                )}

                {/* The null is meaningful: it says the mandal serves but
                    has not announced a time. Never a placeholder hour. */}
                <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--chandan)]">
                  {entry.servesAt ?? 'Timings not announced'}
                  {entry.days && (
                    <span className="text-[var(--muted)]"> · {entry.days}</span>
                  )}
                </span>

                {entry.note && (
                  <span className="mt-1 block text-[12px] leading-relaxed text-[var(--muted)]">
                    {entry.note}
                  </span>
                )}
              </span>

              <ChevronRight
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--faint)]"
              />
            </Link>
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
