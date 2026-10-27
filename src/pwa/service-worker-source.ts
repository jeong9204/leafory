/** Build-time source, also executed in an isolated VM by the worker tests. */
export function serviceWorkerSource(version: string, assets: string[]) {
  return `
const CACHE_PREFIX = 'leafory-shell-';
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const ASSETS = ${JSON.stringify(assets)};
const PATHS = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS.map(path => new Request(path, {cache: 'reload'})));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'ACTIVATE_UPDATE') return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    if (windows.length > 1) {
      event.source?.postMessage({type: 'UPDATE_BLOCKED'});
      return;
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  if (request.mode === 'navigate' && (!PATHS.has(url.pathname) || url.pathname === '/index.html')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match('/index.html')) || fetch(request);
    })());
    return;
  }
  // No runtime caching: never cache blobs, backups, API responses or user records.
  if (url.search || !PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(url.pathname)) || fetch(request);
  })());
});
`
}
