'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only.
 *
 * In development a cached shell fights hot reload, and the caching
 * behaviour we want to test is production behaviour anyway.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      // The build id rides in the URL so a deploy produces a different
      // script URL. That is what makes the browser install a new worker
      // and run `activate`, which is where stale caches are dropped. The
      // registration scope is taken from the path, so the query changes
      // nothing about what this worker controls.
      const url = `/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'}`;
      navigator.serviceWorker.register(url).catch(() => {
        // Offline support is an enhancement; failing to register is not
        // something to surface to the user.
      });
    };

    // Registering after load keeps the SW off the critical path.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
