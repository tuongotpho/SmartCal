
const CACHE_NAME = 'smartcal-cache-v5';
// Sử dụng đường dẫn tuyệt đối / để đảm bảo cache đúng file gốc
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Cache install error', err))
  );
  self.skipWaiting();
});

// Activate Event
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
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
      return;
  }

  // Network First for APIs
  if (event.request.url.includes('firebase') || event.request.url.includes('googleapis') || event.request.url.includes('ai.studio')) {
      event.respondWith(fetch(event.request));
      return;
  }

  // Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(
           networkResponse => {
             if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                   cache.put(event.request, responseToCache);
                });
             }
             return networkResponse;
           }
        ).catch(() => {
           // Silent catch
        });
        return cachedResponse || fetchPromise;
      })
  );
});
