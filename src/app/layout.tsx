import type { Metadata, Viewport } from 'next';
import { Manrope, Mukta } from 'next/font/google';
import { BottomNav } from '@/components/BottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { env } from '@/lib/env';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
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
    <html lang="en" className={`${manrope.variable} ${mukta.variable}`}>
      <body className="min-h-dvh bg-[var(--raat)] antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--shendur)] focus:px-4 focus:py-2 focus:font-semibold focus:text-[#1a0e04]"
        >
          Skip to main content
        </a>
        <OfflineBanner />
        {children}
        <BottomNav />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
