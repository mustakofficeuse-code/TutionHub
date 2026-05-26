// Synced & Highly Durable Background Push Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA-fJgfvF0YaeZCokXA-FQ6WFX4vqYP_4k",
  authDomain: "gen-lang-client-0262745663.firebaseapp.com",
  projectId: "gen-lang-client-0262745663",
  storageBucket: "gen-lang-client-0262745663.firebasestorage.app",
  messagingSenderId: "131834909227",
  appId: "1:131834909227:web:87b5f26eac1c66a2b6506e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background notification received:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'New TuitionHub Alert';
  const body = payload.notification?.body || payload.data?.body || '';

  const notificationOptions = {
    body: body,
    icon: '/notification-badge.png',
    badge: '/notification-badge.png',
    vibrate: [100, 50, 100],
    data: payload.data || {},
    tag: payload.data?.chatId ? `chat_${payload.data.chatId}` : `notification_${Date.now()}`,
    renotify: true,
    requireInteraction: true
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Handle notification interaction (opening correct tab)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  let targetUrl = '/';
  if (data.chatId) {
    targetUrl = `/?openChatId=${data.chatId}`; 
  }

  const navigatePromise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    // Search for any existing open tab of TutionHub
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url && client.url.includes(self.registration.scope) && 'focus' in client) {
         client.postMessage({ type: 'NAVIGATE_TO_CHAT', chatId: data.chatId, msgType: data.type });
         return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  });

  event.waitUntil(navigatePromise);
});

// Active real service worker cache implementation to satisfy guide and remove console warnings of no-op fetch handler
const CACHE_NAME = 'tuitionhub-static-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/gold_tuitionhub_logo_1779680854835.png',
  '/gold_tuitionhub_logo_192.png',
  '/gold_tuitionhub_logo_512.png',
  '/notification-badge.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch((err) => {
      console.warn('[SW] Cache installation skipped/failed:', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept same-origin HTTP/S GET requests to prevent external resource conflict
  if (event.request.url.startsWith(self.location.origin) && event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache, then silently update in background
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          return caches.match('/index.html');
        });
      })
    );
  }
});
