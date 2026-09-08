import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const metadata = { title: 'Offline', robots: { index: false } };

/** Served by the service worker when a navigation fails with no cache entry. */
export default function OfflinePage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--dhoop)]">
          <WifiOff size={24} aria-hidden="true" className="text-[var(--muted)]" />
        </div>
        <h1 className="mt-4 text-[20px] font-bold text-[var(--chandan)]">
          You&rsquo;re offline
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
          This page hasn&rsquo;t been saved to your device yet. Mandals you have
          already opened, and anything you saved, still work.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button asChild size="sm"><Link href="/saved">Saved mandals</Link></Button>
          <Button asChild variant="secondary" size="sm"><Link href="/">Home</Link></Button>
        </div>
      </div>
    </main>
  );
}
