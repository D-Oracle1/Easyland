/* Self-unregistering service worker (kill switch).
 *
 * This REPLACES the previous next-pwa precaching worker, which was serving
 * stale cached assets and breaking client-side navigation until users manually
 * cleared their site data.
 *
 * Browsers re-fetch this file from the network on every service-worker update
 * check (independently of any cache), so simply shipping it reaches every
 * already-affected visitor. On activation it:
 *   1. deletes every Cache Storage bucket (the stale precache), then
 *   2. unregisters itself, then
 *   3. reloads open tabs so they come back clean with NO controlling worker.
 *
 * The app no longer registers this worker (next-pwa was removed), so new visits
 * run with no service worker at all and are served straight from the CDN.
 * Push notifications use a separate, cache-free worker (sw-push.js) and are
 * unaffected. There is deliberately no `fetch` handler here — navigation always
 * goes to the network.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        /* ignore */
      }
      try {
        await self.registration.unregister();
      } catch (e) {
        /* ignore */
      }
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.navigate(client.url);
        }
      } catch (e) {
        /* ignore */
      }
    })(),
  );
});
