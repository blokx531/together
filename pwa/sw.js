/* Together service worker: offline app shell only. It never caches Supabase or any other
 * cross-origin response, so personal data is never stored by the service worker. */
/// <reference lib="webworker" />

const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `together-shell-${BUILD_ID}`;
const PRECACHE_URLS = /** @type {string[]} */ (JSON.parse('__PRECACHE_URLS__'));

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('together-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    // Hashed, immutable build output: cache-first is safe.
    event.respondWith(cacheFirst(request));
  }
});

/** @param {Request} request */
async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/', response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match('/');
    return cached ?? Response.error();
  }
}

/** @param {Request} request */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}
