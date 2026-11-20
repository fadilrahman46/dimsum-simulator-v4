/* Dimsumpreneur service worker: makes the game installable and playable offline after the first visit.
 * Strategy: navigations are network-first (fall back to the cached shell), same-origin static files
 * are stale-while-revalidate. Bump VERSION to drop old caches. Game saves live in IndexedDB, not here. */
const VERSION = 'v1';
const CACHE = `dimsum-${VERSION}`;
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((p) => new URL(p, self.registration.scope).toString())))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dimsum-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(new URL('./', self.registration.scope).toString(), copy));
          return res;
        })
        .catch(() => caches.match(new URL('./', self.registration.scope).toString())),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) void cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    }),
  );
});
