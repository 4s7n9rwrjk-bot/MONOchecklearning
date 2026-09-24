const CACHE_NAME = 'monocheck-study-v20260924-1';
const STATIC_ASSETS = [
  './',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isNetworkFirst(request) {
  const url = new URL(request.url);
  return request.mode === 'navigate' ||
         url.pathname.endsWith('.html') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.json');
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  event.respondWith(
    (isNetworkFirst(request)
      ? fetch(request, { cache: 'no-store' })
          .then(response => {
            if (response && response.ok && new URL(request.url).origin === self.location.origin) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match(request).then(cached => cached || caches.match('./')))
      : caches.match(request).then(cached =>
          cached || fetch(request).then(response => {
            if (response && response.ok && new URL(request.url).origin === self.location.origin) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            }
            return response;
          })
        )
    )
  );
});
