import Link from 'next/link';
import { ArrowLeft, ArrowRight, Languages, Mail, MapPin, Phone } from 'lucide-react';
import { SHOT_META, type GuideContent, type ShotText } from '@/content/how-to-use';

/**
 * The "how to use" guide, rendered from a language's content.
 *
 * One view, two content objects — see src/content/how-to-use.ts. Nothing
 * language-specific lives here: no strings, no conditionals on `lang`.
 * If something reads wrong in Marathi it is fixed in the content file,
 * which is the only place a non-programmer can be pointed at.
 *
 * The step anchors (#crowd, #route, …) are deliberately identical on both
 * pages, so a link someone shared in English still lands on the right
 * step for a reader who switches to Marathi.
 *
 * The screenshots are the same images on both pages. They are captures of
 * the real app, whose interface is English — so the Marathi page shows
 * English screens, which is honest: that is what the reader will meet.
 * Their alt text and captions are translated, since those are ours.
 */

const KEY_COLORS = [
  'var(--crowd-short)',
  'var(--crowd-moving)',
  'var(--crowd-long)',
  'var(--faint)',
];

function Figure({ shot }: { shot: ShotText }) {
  const meta = SHOT_META[shot.id];
  return (
    <figure className="m-0 shrink-0 snap-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
          static asset already served as WebP; next/image would add a
          request and a layout wrapper for no gain. */}
      <img
        src={meta.src}
        alt={shot.alt}
        width={meta.w}
        height={meta.h}
        loading="lazy"
        decoding="async"
        className="block w-[248px] rounded-[14px] border border-[var(--line-strong)] bg-[var(--raat)] sm:w-[280px]"
        style={{ aspectRatio: `${meta.w} / ${meta.h}` }}
      />
      <figcaption className="mt-2 w-[248px] text-[12px] leading-[1.55] text-[var(--faint)] sm:w-[280px]">
        {shot.caption}
      </figcaption>
    </figure>
  );
}

export function HowToUseView({ content: c }: { content: GuideContent }) {
  return (
    <main
      id="main"
      // Declaring the language is all that is needed: globals.css matches
      // :lang(mr) — which also matches mr-IN — and swaps in the
      // Devanagari face and its looser leading. It is also what lets a
      // screen reader switch voice, and what stops the per-element lang
      // attributes further down from being decorative.
      lang={c.lang}
      className="pb-nav md:pb-10"
    >
      <div className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--muted)]"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {c.backLabel}
          </Link>

          {/* The switch is a real link, not a toggle: each language is its
              own URL, so it can be shared, bookmarked and indexed. */}
          <Link
            href={c.alternate.path}
            hrefLang={c.alternate.lang}
            lang={c.alternate.lang}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-3 text-[13px] text-[var(--chandan)] transition-colors hover:border-[var(--shendur)]/50"
          >
            <Languages size={14} aria-hidden="true" className="text-[var(--shendur)]" />
            {c.alternate.label}
          </Link>
        </div>

        <h1 className="font-display mt-2 text-[32px] font-bold leading-tight text-[var(--chandan)]">
          {c.h1}
        </h1>
        <p lang={c.alternate.lang} className="mt-1 text-[14px] text-[var(--muted)]">
          {c.h1Sub}
        </p>

        <p className="prose-measure mt-4 text-[17px] leading-[1.65] text-[var(--chandan)]">
          {c.intro}
        </p>

        {/* Before anything else: location.
            Half of what this guide describes — what is near you, how far,
            and the ability to report a queue at all — is dark without it,
            and a first-time visitor meets that browser prompt within two
            seconds of arriving. */}
        <section
          id="location"
          className="mt-5 scroll-mt-6 rounded-[var(--radius-card)] border border-[var(--shendur)]/35 bg-[var(--dhoop)] p-4"
        >
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--shendur)]">
            <MapPin size={13} aria-hidden="true" />
            {c.location.heading}
          </h2>

          <p className="prose-measure mt-2.5 text-[16px] leading-[1.65] text-[var(--chandan)]">
            {c.location.intro.before}
            <strong className="font-semibold">{c.location.intro.bold}</strong>
            {c.location.intro.after}
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {c.location.points.map((l) => (
              <li
                key={l}
                className="prose-measure flex gap-2.5 text-[14px] leading-[1.6] text-[var(--muted)]"
              >
                <span
                  aria-hidden="true"
                  className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--shendur)]"
                />
                <span>{l}</span>
              </li>
            ))}
          </ul>

          {/* No negative margin here, unlike the step tracks: this one sits
              inside a bordered card, and bleeding to the edge would run the
              images across that border. */}
          <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {c.location.shots.map((shot) => (
              <Figure key={shot.id} shot={shot} />
            ))}
          </div>

          <p className="prose-measure mt-3.5 rounded-[var(--radius-field)] border border-[var(--line)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
            <strong className="font-semibold text-[var(--chandan)]">
              {c.location.blocked.heading}
            </strong>{' '}
            {c.location.blocked.body}
          </p>
        </section>

        {/* The colour key, up front. Everything after this leans on it. */}
        <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
            {c.key.heading}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {c.key.rows.map((k, i) => (
              <li key={k.label} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: KEY_COLORS[i] }}
                />
                <span className="min-w-0 text-[13px] leading-[1.45]">
                  {/* The label is the app's own, in English on both pages —
                      it is what the reader has to recognise on screen. */}
                  <span lang="en" className="font-semibold text-[var(--chandan)]">
                    {k.label}
                  </span>
                  <span className="block text-[var(--faint)]">{k.meaning}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Jump links. A guide people come back to for one step. */}
        <nav aria-label={c.chips.label} className="mt-5 flex flex-wrap gap-1.5">
          <a
            href="#location"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-[var(--shendur)]/40 px-3 py-1.5 text-[13px] text-[var(--chandan)]"
          >
            <MapPin size={12} aria-hidden="true" className="text-[var(--shendur)]" />
            {c.chips.startHere}
          </a>
          {c.steps.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-3 py-1.5 text-[13px] text-[var(--muted)] transition-colors hover:text-[var(--chandan)]"
            >
              <span className="font-mono text-[11px] tabular-nums text-[var(--shendur)]">
                {s.n}
              </span>
              {s.short}
            </a>
          ))}
        </nav>

        <div className="mt-9 flex flex-col gap-11">
          {c.steps.map((step) => (
            <section key={step.id} id={step.id} className="scroll-mt-6">
              <div className="flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[13px] font-bold tabular-nums text-[var(--shendur)]"
                >
                  {String(step.n).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-[23px] font-bold leading-tight text-[var(--chandan)]">
                    {step.title}
                  </h2>
                  <p lang={c.alternate.lang} className="mt-0.5 text-[13px] text-[var(--faint)]">
                    {step.sub}
                  </p>
                </div>
              </div>

              <p className="prose-measure mt-3 text-[16px] leading-[1.68] text-[var(--muted)]">
                {step.lede}
              </p>

              <ol className="mt-4 flex flex-col gap-2.5">
                {step.dos.map((d, i) => (
                  <li key={d} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-[3px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] font-mono text-[11px] tabular-nums text-[var(--zendu)]"
                    >
                      {i + 1}
                    </span>
                    <span className="prose-measure text-[15px] leading-[1.6] text-[var(--chandan)]">
                      {d}
                    </span>
                  </li>
                ))}
              </ol>

              {/* Screenshots side by side, scrolling in their own track so a
                  narrow phone never scrolls the page sideways. */}
              <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
                {step.shots.map((shot) => (
                  <Figure key={shot.id} shot={shot} />
                ))}
              </div>

              {step.note && (
                <div className="prose-measure mt-4 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-[var(--chandan)]">
                    {step.note.heading}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                    {step.note.body}
                  </p>
                </div>
              )}

              {step.cta && (
                <Link
                  href={step.cta.href}
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-[var(--shendur)]"
                >
                  {step.cta.label}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <h2 className="font-display text-[18px] font-bold text-[var(--chandan)]">
            {c.help.heading}
          </h2>
          <p className="prose-measure mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
            {c.help.body}
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <a
              href="mailto:singhgurnoor080@gmail.com"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-4 text-[14px] font-semibold text-[var(--chandan)]"
            >
              <Mail size={15} aria-hidden="true" className="text-[var(--shendur)]" />
              {c.help.email}
            </a>
            <a
              href="tel:+916283031102"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-4 text-[14px] font-semibold text-[var(--chandan)]"
            >
              <Phone size={15} aria-hidden="true" className="text-[var(--shendur)]" />
              {c.help.call}
            </a>
            <Link
              href="/about#contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-4 text-[14px] text-[var(--muted)]"
            >
              {c.help.more}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
