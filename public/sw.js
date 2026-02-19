
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqySsLO1mHWhTP9JDJ81OpF0XwDDbFHFM",
  authDomain: "nhacviec-87.firebaseapp.com",
  projectId: "nhacviec-87",
  storageBucket: "nhacviec-87.firebasestorage.app",
  messagingSenderId: "599507356600",
  appId: "1:599507356600:web:6e7244776ae2d828945d4d",
  measurementId: "G-5PWJQNSEFF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const CACHE_NAME = 'smartcal-cache-v6';
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

// ==========================================
// FIREBASE CLOUD MESSAGING - BACKGROUND HANDLER
// ==========================================

// Handle background messages (khi app không mở hoặc ở background)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || '🔔 SmartCal Nhắc việc';
  const notificationOptions = {
    body: payload.notification?.body || 'Bạn có công việc cần làm!',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: payload.data?.taskId || 'smartcal-reminder',
    data: payload.data || {},
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Mở ứng dụng' },
      { action: 'dismiss', title: 'Bỏ qua' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  // Xử lý action
  if (event.action === 'dismiss') {
    return;
  }

  // Mở app hoặc focus vào tab hiện có
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Tìm tab đang mở SmartCal
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Post message để app biết có notification click
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: event.notification.data
            });
            return client.focus();
          }
        }
        // Nếu không có tab nào, mở mới
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

// Listen for messages from main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message from main app:', event.data);
  
  // Handle specific commands
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
