import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import catalogue from '@/content/catalogue.json';

/**
 * The card people actually see when this link is pasted somewhere.
 *
 * A festival app spreads by being forwarded — into family WhatsApp groups,
 * into society threads, into an Instagram story. Until this existed those
 * links rendered as a bare grey rectangle with a URL in it, which is the
 * difference between a link someone taps and one they scroll past. This is
 * reach, not decoration.
 *
 * Rendered by Satori, which is NOT a browser: flexbox only, no grid, no
 * float, and every element holding more than one child needs an explicit
 * `display: flex`. Anything clever fails silently by rendering nothing.
 *
 * Statically generated at build time (no request-time APIs are used here),
 * so serving it costs nothing at festival traffic.
 */

export const alt =
  'Pune Ganpati Darshan — find mandals, see live queues, and plan a walkable darshan route';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Mukta, vendored rather than fetched.
 *
 * Satori cannot read woff2, which is all `next/font` leaves in .next, and a
 * build-time fetch from Google would make every deploy depend on a third
 * party being up. Mukta covers Devanagari and Latin in one family, so the
 * Marathi greeting and the English name share typography instead of the
 * greeting rendering as tofu boxes — which would be worse than omitting it.
 */
const [regular, bold] = await Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/Mukta-Regular.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/Mukta-Bold.ttf')),
]);

/** Palette lifted from globals.css so the card matches the app. */
const RAAT = '#14100C';
const CHANDAN = '#F3ECE2';
const SHENDUR = '#E8863C';
const MUTED = '#A89A88';
const PITAL = '#C9A227';

/**
 * The Ganpati mark, flattened.
 *
 * The app draws this via <GanpatiGlyphSprite> and `<use href="#pg-ganpati">`,
 * which Satori cannot resolve — it has no document to look the symbol up in.
 * So the shapes are inlined here, with `currentColor` and the knockout CSS
 * variable resolved to literals for the same reason.
 *
 * This is a copy, and copies drift: if the artwork in GanpatiGlyphSprite
 * changes, this card keeps the old drawing until someone re-flattens it.
 * Accepted deliberately — it is decorative here, and the alternative was
 * restructuring a component the whole catalogue renders.
 */
const GANPATI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><path d="M34 32C24 26 12 28 7 37c-5 9-2 22 6 28 6 5 14 5 21 1Z" fill="#E8863C" opacity=".6" /><path d="M66 32c10-6 22-4 27 5 5 9 2 22-6 28-6 5-14 5-21 1Z" fill="#E8863C" opacity=".6" /><circle cx="50" cy="6" r="3.4" fill="#E8863C" /><path d="M50 11c6 0 11 4 13 10H37c2-6 7-10 13-10Z" fill="#E8863C" /><rect x="34" y="21" width="32" height="4.5" rx="2.2" fill="#E8863C" /><path d="M50 26c11 0 19 8 19 18v9c0 10-8 18-19 18s-19-8-19-18v-9c0-10 8-18 19-18Z" fill="#E8863C" /><path d="M39 58c-.5 6 .3 10 2.4 12.6-2.8-.6-4.6-4-4.4-8.4Z" fill="#E8863C" opacity=".8" /><path d="M61 58c.5 6-.3 10-2.4 12.6 2.8-.6 4.6-4 4.4-8.4Z" fill="#E8863C" opacity=".8" /><path d="M50 57c0 8-.6 14-4 18.5-2.6 3.4-2 7.5 1.8 8.6 3 .9 5.6-.9 5.9-3.6" stroke="#E8863C" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" /><ellipse cx="41" cy="40" rx="3" ry="3.6" fill="#14100C" /><ellipse cx="59" cy="40" rx="3" ry="3.6" fill="#14100C" /><path d="M50 29.5c1.4 0 2.5 1.6 2.5 3.6S51.4 37 50 37s-2.5-1.6-2.5-3.9 1.1-3.6 2.5-3.6Z" fill="#14100C" opacity=".55" /></svg>`;
const GANPATI_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(GANPATI_SVG).toString('base64')}`;

export default function Image() {
  const mandalCount = catalogue.ganpatis.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: RAAT,
          // Satori supports linear-gradient; a warm lamp glow from the
          // lower left, matching the app's night-of-the-festival feel.
          backgroundImage: `radial-gradient(circle at 12% 88%, rgba(232,134,60,0.22), transparent 55%), radial-gradient(circle at 88% 12%, rgba(201,162,39,0.14), transparent 50%)`,
          padding: 68,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              color: PITAL,
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            गणपती बाप्पा मोरया
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 82,
              fontWeight: 700,
              color: CHANDAN,
              lineHeight: 1.08,
              marginTop: 18,
              maxWidth: 900,
            }}
          >
            Pune Ganpati Darshan
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 34,
              color: MUTED,
              marginTop: 20,
              maxWidth: 880,
              lineHeight: 1.35,
            }}
          >
            Find mandals, see how busy they are right now, and plan a walkable
            route through the old peths.
          </div>
          </div>

          {/* Satori renders SVG only through <img> with a data URI; an inline
              <svg> element is ignored. */}
          <img src={GANPATI_DATA_URI} width={270} height={270} alt="" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: `2px solid ${SHENDUR}`,
              borderRadius: 999,
              padding: '10px 26px',
              fontSize: 26,
              fontWeight: 700,
              color: SHENDUR,
            }}
          >
            {mandalCount} mandals
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              color: MUTED,
            }}
          >
            ganpatipune.in
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Mukta', data: regular, style: 'normal', weight: 400 },
        { name: 'Mukta', data: bold, style: 'normal', weight: 700 },
      ],
    }
  );
}
