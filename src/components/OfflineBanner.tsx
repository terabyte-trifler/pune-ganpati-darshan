'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Tells the user why things look stale, rather than failing silently (§35). */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-50 flex items-center justify-center gap-2 bg-[var(--zendu)] px-4 py-1.5 text-[12px] font-semibold text-[#1a1405]"
      style={{ top: 'var(--safe-top)' }}
    >
      <WifiOff size={13} aria-hidden="true" />
      You&rsquo;re offline. Showing saved information.
    </div>
  );
}
