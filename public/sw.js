const CACHE_NAME_STATIC = 'app-static-v1';
const CACHE_NAME_DYNAMIC = 'app-dynamic-v1';
const CACHE_NAME_TILES = 'map-tiles-v1';

// Max 150 entries for at forhindre at storage fyldes op
const MAX_TILE_CACHE_ENTRIES = 150;

const APP_SHELL = [
  '/',
  '/play',
  '/dashboard'
];

// Sikker loop-baseret cleanup (erstatter tidligere rekursiv metode)
async function limitCacheSize(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let excess = keys.length - maxItems;
    let i = 0;
    
    while (excess > 0) {
      await cache.delete(keys[i]);
      i++;
      excess--;
    }
  } catch (err) {
    console.warn('[SW] Cache cleanup failed', err);
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME_STATIC).then((cache) => {
      return Promise.allSettled(APP_SHELL.map(url => cache.add(url).catch(() => {})));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (![CACHE_NAME_STATIC, CACHE_NAME_DYNAMIC, CACHE_NAME_TILES].includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Tile Caching: Stale-While-Revalidate + Offline SVG Fallback
  if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME_TILES).then((cache) => {
              cache.put(request, responseToCache);
              limitCacheSize(CACHE_NAME_TILES, MAX_TILE_CACHE_ENTRIES);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Offline SVG placeholder returneres hvis netværk fejler og ingen cache findes
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="rgba(0,0,0,0.03)"/>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        });

        event.waitUntil(fetchPromise);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Static Assets: Cache-First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME_STATIC).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        }).catch(() => null);
      })
    );
    return;
  }

  // Navigation & API: Network-First med fallback
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME_DYNAMIC).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(request).then((cachedResponse) => cachedResponse || caches.match('/'));
      })
    );
    return;
  }
});