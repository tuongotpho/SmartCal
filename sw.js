
const CACHE_NAME = 'smartcal-cache-v6';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png', // Fallback if exists
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install Event: Cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', event => {
  // Bỏ qua các request non-GET hoặc chrome-extension
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Với API Firebase/Gemini, ta ưu tiên mạng (Network First)
  if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if valid
        const fetchPromise = fetch(event.request).then(
          networkResponse => {
            // Cập nhật cache nếu mạng OK
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          }
        );
        return cachedResponse || fetchPromise;
      })
  );
});
