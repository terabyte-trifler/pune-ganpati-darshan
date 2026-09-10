import type { Metadata, Viewport } from 'next';
import { Manrope, Mukta, Fraunces } from 'next/font/google';
import { BottomNav } from '@/components/BottomNav';
import { GanpatiGlyphSprite } from '@/components/ui/GanpatiGlyphSprite';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { env } from '@/lib/env';
import './globals.css';
import { SiteFooter } from '@/components/SiteFooter';

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
    "Discover Pune's Ganpati mandals, see what's near you, and plan a walkable darshan route through the old peths for Ganeshotsav.",
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

export const viewport: Viewport = {
  themeColor: '#14100C',
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available (capping at 1 would fail accessibility),
  // but the layout is designed so nobody needs it.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${mukta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-[var(--raat)] antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--shendur)] focus:px-4 focus:py-2 focus:font-semibold focus:text-[#1a0e04]"
        >
          Skip to main content
        </a>
        <GanpatiGlyphSprite />
        <OfflineBanner />
        {children}
        <SiteFooter />
        <BottomNav />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
