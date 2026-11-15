const PRECACHE = ["./","assets/ammo-BNmSttkf.js","assets/barlow-semi-condensed-latin-600-normal-BkLiAYu4.woff2","assets/barlow-semi-condensed-latin-700-normal-BpqDG8I9.woff2","assets/barlow-semi-condensed-latin-ext-600-normal-BkQ9hN72.woff2","assets/barlow-semi-condensed-latin-ext-700-normal-BhgEo64M.woff2","assets/huntFirebase-BlIaEHpr.js","assets/index-9km7-cKE.js","assets/index-C5plRAnw.js","assets/index-C6s81kSZ.css","assets/index-CAFE9BHo.js","assets/index-DbN8-o1v.js","assets/index-lbEhUqN3.js","assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","assets/inter-latin-wght-normal-Dx4kXJAl.woff2","assets/jetbrains-mono-latin-ext-wght-normal-DBQx-q_a.woff2","assets/jetbrains-mono-latin-wght-normal-B9CIFXIH.woff2","assets/manrope-latin-ext-wght-normal-Ch3YOpNY.woff2","assets/manrope-latin-wght-normal-DHIcAJRg.woff2","assets/qrcode-C2_U8-rg.js","assets/web-Bn0WNtis.js","assets/web-DMmbv7Zl.js","assets/web-DPiP0tDY.js","index.html","data/districts.json","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
const VERSION = "ed641d69b017";
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
