// Firebase Cloud Messaging Service Worker
// This file is required by FCM SDK

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Firebase config
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

// Initialize Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Nhắc nhở';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: payload.data?.taskId || 'default',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event);
  
  event.notification.close();

  // Open or focus the app
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
