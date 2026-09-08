/**
 * The Ganpati mark, defined once per document and referenced by every card.
 *
 * The glyph is ~15 paths. Inlining it per card meant 23 copies on /explore and
 * 10 on the home rail, which is a lot of DOM and paint for one drawing —
 * measurably so once the home page started showing mandals instead of a
 * prompt. A single <symbol> plus <use> keeps the artwork identical while
 * paying for it once.
 *
 * The eye knockout still varies per card: it reads the CSS variable
 * --glyph-knockout, which <use> inherits from the referencing element.
 */
export function GanpatiGlyphSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <symbol id="pg-ganpati" viewBox="0 0 100 100" fill="none">


      {/* Ears — drawn first and widest; they are what makes it read as Ganpati */}
      <path
        d="M34 32C24 26 12 28 7 37c-5 9-2 22 6 28 6 5 14 5 21 1Z"
        fill="currentColor" opacity=".6"
      />
      <path
        d="M66 32c10-6 22-4 27 5 5 9 2 22-6 28-6 5-14 5-21 1Z"
        fill="currentColor" opacity=".6"
      />

      {/* Mukut — finial, then the crown itself */}
      <circle cx="50" cy="6" r="3.4" fill="currentColor" />
      <path
        d="M50 11c6 0 11 4 13 10H37c2-6 7-10 13-10Z"
        fill="currentColor"
      />
      <rect x="34" y="21" width="32" height="4.5" rx="2.2" fill="currentColor" />

      {/* Head */}
      <path
        d="M50 26c11 0 19 8 19 18v9c0 10-8 18-19 18s-19-8-19-18v-9c0-10 8-18 19-18Z"
        fill="currentColor"
      />

      {/* Tusks — flanking the trunk, angled outward so they stay visible */}
      <path d="M39 58c-.5 6 .3 10 2.4 12.6-2.8-.6-4.6-4-4.4-8.4Z" fill="currentColor" opacity=".8" />
      <path d="M61 58c.5 6-.3 10-2.4 12.6 2.8-.6 4.6-4 4.4-8.4Z" fill="currentColor" opacity=".8" />

      {/* Trunk — emerges from beneath the head, drops, then curls to one side.
          Kept lighter than the head so the two do not merge into one blob. */}
      <path
        d="M50 57c0 8-.6 14-4 18.5-2.6 3.4-2 7.5 1.8 8.6 3 .9 5.6-.9 5.9-3.6"
        stroke="currentColor" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round"
      />

      {/* Eyes — knocked out so they stay visible at any size */}
      <ellipse cx="41" cy="40" rx="3" ry="3.6" fill="var(--glyph-knockout, #14100c)" />
      <ellipse cx="59" cy="40" rx="3" ry="3.6" fill="var(--glyph-knockout, #14100c)" />

      {/* Tilak */}
      <path d="M50 29.5c1.4 0 2.5 1.6 2.5 3.6S51.4 37 50 37s-2.5-1.6-2.5-3.9 1.1-3.6 2.5-3.6Z"
            fill="var(--glyph-knockout, #14100c)" opacity=".55" />
      </symbol>
    </svg>
  );
}
