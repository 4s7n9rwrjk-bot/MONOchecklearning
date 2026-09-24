const CACHE_NAME = 'monocheck-study-pwa-v20260924-2';
const APP_SHELL = ['./', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase/Auth/CDN等の外部通信には絶対に介入しない
  if (url.origin !== self.location.origin) return;

  // HTML/JS/設定は常にネットワーク優先
  const networkFirst =
    request.mode === 'navigate' ||
    /\.(html|js|json)$/.test(url.pathname);

  if (networkFirst) {
    event.respondWith(
      fetch(request, {cache:'no-store'})
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('./')))
    );
  } else {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return response;
        })
      )
    );
  }
});
