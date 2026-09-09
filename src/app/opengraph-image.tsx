import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import catalogue from '@/content/catalogue.json';

/**
 * The card people actually see when this link is pasted somewhere.
 *
 * A festival app spreads by being forwarded — into family WhatsApp groups,
 * into society threads, into a story. Without this the link renders as a
 * bare grey rectangle, which is the difference between a link someone taps
 * and one they scroll past. This is reach, not decoration.
 *
 * The right half shows the crowd panel rather than more words, because
 * live queue reporting is the one thing this app does that a listicle
 * cannot, and a preview card gets about one second of attention. It uses
 * the real crowd vocabulary — the same three colours and the same three
 * shapes as CrowdBadge, so the shape carries the level for a colour-blind
 * reader exactly as it does in the app.
 *
 * Rendered by Satori, which is NOT a browser: flexbox only, no grid, no
 * float, every multi-child element needs an explicit `display: flex`, and
 * SVG arrives only through <img> with a data URI. Anything clever fails
 * silently by rendering nothing at all.
 *
 * Statically generated at build time, so serving it costs nothing at
 * festival traffic.
 */

export const alt =
  'Pune Ganpati Darshan — find mandals, see live queue reports, and plan a walkable darshan route through the peths';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Fonts are vendored rather than fetched.
 *
 * Satori cannot read the woff2 that `next/font` leaves in .next, and a
 * build-time fetch from Google would make every deploy depend on a third
 * party being reachable.
 *
 * Fraunces is the app's display serif and is shipped upstream only as a
 * variable font, whose default instance is opsz 9 — letterforms drawn for
 * captions, which look coarse blown up to 72px. This is a static cut
 * pinned to wght 700 / opsz 96, matching the weight layout.tsx already
 * loads. Mukta carries Devanagari and Latin so the Marathi greeting sets
 * in a real face instead of tofu boxes.
 */
const [display, body, bodyBold] = await Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/Fraunces-Display700.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/Mukta-Regular.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/Mukta-Bold.ttf')),
]);

/* Palette copied from globals.css. */
const RAAT = '#14100C';
const DHOOP = '#1F1913';
const CHANDAN = '#F0E6D2';
const SHENDUR = '#E2621B';
const ZENDU = '#F2A93B';
const MUTED = 'rgba(240,230,210,0.62)';
const FAINT = 'rgba(240,230,210,0.50)';
const LINE = 'rgba(240,230,210,0.12)';

const CROWD = {
  short: '#5FB872',
  moving: '#F2A93B',
  long: '#E5544B',
};

/**
 * The Ganpati mark, flattened to a single-colour silhouette.
 *
 * The app draws this with `<use href="#pg-ganpati">`, which Satori cannot
 * resolve — it has no document to look a symbol up in — so the shapes are
 * inlined and `currentColor` plus the knockout variable are resolved to
 * literals. Per-shape opacity is KEPT — it is what separates the ears from
 * the head; flattening it turned the mark into an orange blob that read as
 * a mushroom. The eye and trunk knockouts are painted in the card's own
 * surface colour, since that is what sits behind them here.
 *
 * This is a copy and copies drift: if GanpatiGlyphSprite's artwork changes
 * this card keeps the old drawing until someone re-flattens it. Accepted
 * because it is decorative here, and the alternative was restructuring a
 * component every catalogue page renders.
 */
const GANPATI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><path d="M34 32C24 26 12 28 7 37c-5 9-2 22 6 28 6 5 14 5 21 1Z" fill="#E2621B" opacity=".6" /><path d="M66 32c10-6 22-4 27 5 5 9 2 22-6 28-6 5-14 5-21 1Z" fill="#E2621B" opacity=".6" /><circle cx="50" cy="6" r="3.4" fill="#E2621B" /><path d="M50 11c6 0 11 4 13 10H37c2-6 7-10 13-10Z" fill="#E2621B" /><rect x="34" y="21" width="32" height="4.5" rx="2.2" fill="#E2621B" /><path d="M50 26c11 0 19 8 19 18v9c0 10-8 18-19 18s-19-8-19-18v-9c0-10 8-18 19-18Z" fill="#E2621B" /><path d="M39 58c-.5 6 .3 10 2.4 12.6-2.8-.6-4.6-4-4.4-8.4Z" fill="#E2621B" opacity=".8" /><path d="M61 58c.5 6-.3 10-2.4 12.6 2.8-.6 4.6-4 4.4-8.4Z" fill="#E2621B" opacity=".8" /><path d="M50 57c0 8-.6 14-4 18.5-2.6 3.4-2 7.5 1.8 8.6 3 .9 5.6-.9 5.9-3.6" stroke="#E2621B" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round" /><ellipse cx="41" cy="40" rx="3" ry="3.6" fill="#1F1913" /><ellipse cx="59" cy="40" rx="3" ry="3.6" fill="#1F1913" /><path d="M50 29.5c1.4 0 2.5 1.6 2.5 3.6S51.4 37 50 37s-2.5-1.6-2.5-3.9 1.1-3.6 2.5-3.6Z" fill="#1F1913" opacity=".55" /></svg>`;
const GANPATI_URI = `data:image/svg+xml;base64,${Buffer.from(GANPATI_SVG).toString('base64')}`;

/**
 * Level is carried by shape as well as colour, matching CrowdBadge: a
 * circle for short, a square for moving, a diamond for long. Satori
 * supports `transform`, so the diamond is a rotated square as in the app.
 */
function Dot({ level }: { level: keyof typeof CROWD }) {
  const base = {
    display: 'flex',
    width: 16,
    height: 16,
    background: CROWD[level],
  } as const;
  if (level === 'short') return <div style={{ ...base, borderRadius: 99 }} />;
  if (level === 'moving') return <div style={{ ...base, borderRadius: 3 }} />;
  return <div style={{ ...base, borderRadius: 3, transform: 'rotate(45deg)' }} />;
}

function Row({
  name,
  level,
  label,
  last,
}: {
  name: string;
  level: keyof typeof CROWD;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 15,
        paddingBottom: 15,
        borderBottom: last ? 'none' : `1px solid ${LINE}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Dot level={level} />
        <div style={{ display: 'flex', fontSize: 21, color: CHANDAN }}>{name}</div>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 19,
          fontWeight: 700,
          color: CROWD[level],
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${LINE}`,
        background: 'rgba(240,230,210,0.04)',
        borderRadius: 999,
        padding: '9px 20px',
        fontSize: 21,
        color: CHANDAN,
      }}
    >
      {children}
    </div>
  );
}

export default function Image() {
  const mandalCount = catalogue.ganpatis.length;
  const year = catalogue.festival?.year ?? new Date().getFullYear();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          // Satori falls back to the FIRST font in the `fonts` array for any
          // node that names none. Fraunces is first because the title asks
          // for it by name, so without this every pill, row and caption sets
          // in the display serif.
          fontFamily: 'Mukta',
          background: RAAT,
          // Lamp glow, warm from the lower left as on the app's night ground.
          backgroundImage:
            'radial-gradient(circle at 8% 92%, rgba(226,98,27,0.20), transparent 52%),' +
            'radial-gradient(circle at 92% 8%, rgba(242,169,59,0.12), transparent 48%)',
          padding: 34,
        }}
      >
        {/* Inset card, so the glow reads as a ground the card sits on. */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            background: DHOOP,
            border: `1px solid ${LINE}`,
            borderRadius: 26,
            padding: 46,
            gap: 40,
          }}
        >
          {/* ---------------- Left: who and what ---------------- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{ display: 'flex', width: 46, height: 4, background: SHENDUR, borderRadius: 2 }}
              />
              <div
                style={{
                  display: 'flex',
                  marginTop: 16,
                  fontSize: 21,
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: SHENDUR,
                }}
              >
                GANESHOTSAV {year}
              </div>

              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Fraunces',
                  fontSize: 68,
                  color: CHANDAN,
                  lineHeight: 1.06,
                  marginTop: 14,
                  maxWidth: 520,
                }}
              >
                Pune Ganpati Darshan
              </div>

              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
                  color: MUTED,
                  marginTop: 16,
                  maxWidth: 520,
                  lineHeight: 1.4,
                }}
              >
                See how busy each mandal is right now, and plan a walkable route
                through the old peths.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Pill>{`${mandalCount} mandals`}</Pill>
                <Pill>Curated routes</Pill>
                <Pill>Works offline</Pill>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: ZENDU }}>
                  गणपती बाप्पा मोरया
                </div>
                <div style={{ display: 'flex', fontSize: 22, color: FAINT }}>·</div>
                <div style={{ display: 'flex', fontSize: 22, color: CHANDAN }}>
                  ganpatipune.in
                </div>
              </div>
            </div>
          </div>

          {/* ---------------- Right: the live crowd panel ---------------- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: 384,
              gap: 20,
            }}
          >
            {/* Given real presence rather than hidden at watermark opacity —
                a Ganeshotsav card with no Ganpati on it is a miss. */}
            <img src={GANPATI_URI} width={132} height={132} alt="" style={{ opacity: 0.92 }} />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              flex: 1,
              background: 'rgba(20,16,12,0.55)',
              border: `1px solid ${LINE}`,
              borderRadius: 20,
              padding: 26,
              // The panel stretches to the card's height; without this the
              // rows bunch at the top and ~150px pools under the caption.
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* A live pip, the same vermilion the app uses for action. */}
              <div
                style={{ display: 'flex', width: 10, height: 10, borderRadius: 99, background: SHENDUR }}
              />
              <div
                style={{
                  display: 'flex',
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: 2.5,
                  color: FAINT,
                }}
              >
                CROWD RIGHT NOW
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
              <Row name="Dagdusheth" level="short" label="Short" />
              <Row name="Kasba Ganpati" level="moving" label="Moving" />
              <Row name="Tulshibaug" level="long" label="30+ min" last />
            </div>

            <div
              style={{
                display: 'flex',
                marginTop: 14,
                fontSize: 17,
                color: FAINT,
                lineHeight: 1.35,
              }}
            >
              Reported by devotees, not guessed.
            </div>
          </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: display, style: 'normal', weight: 700 },
        { name: 'Mukta', data: body, style: 'normal', weight: 400 },
        { name: 'Mukta', data: bodyBold, style: 'normal', weight: 700 },
      ],
    }
  );
}
