/**
 * Ganpati silhouette used where no photograph exists.
 *
 * A drawn symbol rather than a photograph, deliberately: it is obviously an
 * illustration, so it decorates the card without implying it depicts that
 * particular mandal. It replaced the mandal's initial letter, which read as a
 * missing asset rather than a considered placeholder.
 *
 * The artwork lives in <GanpatiGlyphSprite>, rendered once per document; this
 * only references it. See that file for why.
 */
export function GanpatiGlyph({
  className,
  title,
  /** Colour showing through the knocked-out eyes; match the surface behind. */
  knockout = 'var(--raat)',
}: {
  className?: string;
  /** Omit for decorative use; the surrounding element carries the label. */
  title?: string;
  knockout?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      style={{ ['--glyph-knockout' as string]: knockout }}
    >
      {title && <title>{title}</title>}
      <use href="#pg-ganpati" />
    </svg>
  );
}
