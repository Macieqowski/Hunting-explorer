// The app used to live at the root of the site and kept a service worker there. It now lives in
// ./app/ with its own worker (sw/service-worker.js), so this one only tidies up after the old
// one: it removes the old saved copy of the app and then itself. Offline maps and everything
// the app saved (hunts, settings) are stored elsewhere and are not touched.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('app-')).map((k) => caches.delete(k))))
      .then(() => self.registration.unregister()),
  );
});
