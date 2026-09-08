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
      navigator.serviceWorker.register('/sw.js').catch(() => {
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
