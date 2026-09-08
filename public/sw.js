/**
 * Service worker.
 *
 * Strategy is chosen per resource type, because a festival visitor is
 * outdoors on a congested network:
 *
 *   navigation      network-first, falling back to cache, then /offline
 *   catalogue data  stale-while-revalidate (mandal info must stay readable)
 *   static assets   cache-first (immutable, content-hashed)
 *   Google Maps     never cached (tiles are huge and licence-restricted)
 *   API / analytics never cached
 */

const VERSION = 'v1';
const SHELL_CACHE = `pg-shell-${VERSION}`;
const DATA_CACHE = `pg-data-${VERSION}`;
const ASSET_CACHE = `pg-assets-${VERSION}`;

/** Pages worth having available cold. Kept small — this is a phone. */
const PRECACHE = ['/', '/explore', '/plan', '/saved', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individual failures must not abort the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, DATA_CACHE, ASSET_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isMapsRequest(url) {
  return (
    url.hostname.endsWith('googleapis.com') ||
    url.hostname.endsWith('gstatic.com') ||
    url.hostname.endsWith('google.com')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept Maps or our own API — stale map tiles and stale route
  // results are worse than no result.
  if (isMapsRequest(url) || url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  // ---- Navigations: network-first ----
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match('/offline')) ?? Response.error();
        })
    );
    return;
  }

  // ---- Next static assets: cache-first (content-hashed, immutable) ----
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // ---- Everything else same-origin: stale-while-revalidate ----
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(DATA_CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    })
  );
});
