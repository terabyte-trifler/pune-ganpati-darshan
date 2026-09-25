import type { Metadata, Viewport } from 'next';
import { Manrope, Mukta, Fraunces } from 'next/font/google';
import { BottomNav } from '@/components/BottomNav';
import { GanpatiGlyphSprite } from '@/components/ui/GanpatiGlyphSprite';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { JsonLd, siteGraph } from '@/lib/seo/jsonld';
import { env } from '@/lib/env';
import './globals.css';
import { SiteFooter } from '@/components/SiteFooter';
import { FestivalConfigProvider } from '@/features/crowd/FestivalPhaseProvider';
import { getAllGanpatis, getFestivalConfig } from '@/services/ganpati';
import { DwellSignal } from '@/features/crowd/DwellSignal';
import { LocationWarmup } from '@/components/LocationWarmup';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

/**
 * Display face, used only for the hero and large section titles.
 *
 * Manrope is an excellent interface font and a flat one at display sizes —
 * every heading read like a label. Fraunces has real optical variation and
 * warmth at large sizes, which is what makes a festival page feel like an
 * occasion rather than a directory. It is deliberately confined to headings:
 * body copy and controls stay in Manrope, because this gets read outdoors on
 * a phone.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  // One static instance. The variable file carries optical axes that render
  // slightly better at display sizes, and two weights read marginally
  // richer, but both put more bytes on the critical path — the hero heading
  // is the LCP element and this ships to phones on 4G.
  weight: ['700'],
});

/**
 * Devanagari face for Marathi content (§5).
 *
 * Not preloaded, and carrying only the weights actually used: Marathi is
 * secondary text on every screen, so making it render-blocking costs
 * Speed Index for no benefit. It swaps in a moment after first paint.
 */
const mukta = Mukta({
  subsets: ['devanagari'],
  variable: '--font-mukta',
  display: 'swap',
  weight: ['400', '600'],
  preload: false,
  fallback: ['Noto Sans Devanagari', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: 'Pune Ganpati Darshan — find mandals, plan your route',
    template: '%s · Pune Ganpati Darshan',
  },
  description:
    "Every Ganpati mandal in Pune on one map, with walkable darshan routes through the old peths for Ganeshotsav. Free and non-commercial — no ads, no account.",
  applicationName: 'Pune Ganpati Darshan',
  manifest: '/manifest.webmanifest',
  // favicon.ico is picked up from app/ by convention, but iOS only
  // auto-discovers an apple-touch-icon at the site ROOT. Ours lives under
  // /icons, so without this link "Add to Home Screen" fell back to a
  // screenshot of the page instead of the app mark.
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Pune Ganpati',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Pune Ganpati Darshan',
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
};

/**
 * Run the functions next to the users and the database.
 *
 * Vercel's default function region is iad1, Washington DC. Measured on
 * production before this line existed: every dynamic request entered at
 * bom1 (Mumbai, ~40ms from Pune) and then executed in iad1 — while
 * Supabase answers from BOM. So each database round trip crossed the
 * Pacific twice, at roughly 330ms, and a vote made five of them in
 * sequence: 2.04s median, against a 300ms target.
 *
 * Declared on the root layout, which every route segment inherits, so a
 * new API route cannot quietly be born in Virginia.
 *
 * bom1 rather than a multi-region list on purpose: the database is in one
 * place, and a function far from Postgres is slower than a function far
 * from the user — reads are cached at the edge, queries are not.
 */
export const preferredRegion = 'bom1';

export const viewport: Viewport = {
  themeColor: '#14100C',
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available (capping at 1 would fail accessibility),
  // but the layout is designed so nobody needs it.
  maximumScale: 5,
  viewportFit: 'cover',
};

/**
 * Async for two things: the festival's dates, and where the mandals are.
 *
 * The "usually" prior colours mandals nobody has reported, and to do that
 * it has to know which day of the festival it is. The dwell tracker needs
 * the mandal coordinates for the same reason it always did.
 *
 * Both are fetched here rather than threaded through components, and
 * together rather than in sequence. Every page in the app is revalidated
 * rather than rendered per request, so this costs two queries an hour.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [festival, ganpatis] = await Promise.all([
    getFestivalConfig(),
    getAllGanpatis(),
  ]);

  // Shadow mode, off unless the flag is set. Read on the server so a
  // build with it off ships no collection at all.
  const dwellShadow = process.env.CROWD_DWELL_SHADOW === '1';

  return (
    <html lang="en" className={`${manrope.variable} ${mukta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-[var(--raat)] antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--shendur)] focus:px-4 focus:py-2 focus:font-semibold focus:text-[#1a0e04]"
        >
          Skip to main content
        </a>
        <JsonLd data={siteGraph()} />
        <GanpatiGlyphSprite />
        <OfflineBanner />
        <FestivalConfigProvider config={festival}>
          {children}
          <SiteFooter />
          <BottomNav />
          {/* One mount, for the whole app.
              It ran on /map, then on a mandal page too, and still saw
              almost nothing: day one of the festival produced a single
              countable sample in the whole city. The reason is where
              people actually are — the home screen, the explore grid, a
              route — and on every one of those the tracker was simply not
              running.

              Mounting it once here rather than per page also settles the
              double-counting worry that kept it narrow in the first
              place: there is exactly one mount, the visit clock lives in
              module state so navigation does not restart it, and the
              per-(device, mandal, day) key would collapse duplicates
              anyway. */}
          {dwellShadow && (
            <DwellSignal
              enabled
              mandals={ganpatis.map((g) => ({
                id: g.id,
                lat: g.location.lat,
                lng: g.location.lng,
                prominence: g.prominence,
              }))}
            />
          )}
          {/* Starts locating on load where permission is already granted,
              so a screen that needs a position is not the first to ask.
              Prompts nobody — see LocationWarmup. */}
          <LocationWarmup />
        </FestivalConfigProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
