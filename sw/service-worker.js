// Service worker: lets the app open without signal.
// The build (vite.config.ts) prepends PRECACHE (the app's own files) and VERSION.
//
// - Page loads: network first, the saved copy when offline.
// - The app's other files (scripts, styles, exam questions and pictures): saved copy first.
// - Map tiles and other servers are not touched here; the app keeps tiles itself.

/* global PRECACHE, VERSION */
// 'app-…' was the name used while the app lived at the root of the site; those copies are removed.
const PREFIX = 'polowanie-app-';
const CACHE = PREFIX + VERSION;
const scope = self.registration.scope;
const INDEX = new URL('index.html', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((p) => new URL(p, scope).href))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith(PREFIX) && k !== CACHE) || k.startsWith('app-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !req.url.startsWith(scope)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(INDEX, copy));
          }
          return res;
        })
        .catch(() => caches.match(INDEX, { cacheName: CACHE }).then((r) => r || caches.match(INDEX))),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
