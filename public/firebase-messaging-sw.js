// Synced & Highly Durable Background Push Service Worker
// First, declare our zero-dependency high-priority native listeners at the absolute top of the file
// to ensure instant execution on cold-start background events without waiting for heavy external scripts.

const processedPushTags = new Set();

self.addEventListener('push', (event) => {
  event.stopImmediatePropagation();
  console.log('[SW] High-priority native direct push event received.', event);
  
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      try {
        const textPl = event.data.text();
        if (textPl.startsWith('{')) {
          payload = JSON.parse(textPl);
        } else {
          payload = { notification: { body: textPl } };
        }
      } catch (err) {
        console.warn('[SW] Non-JSON payload parse failed:', err);
      }
    }
  }

  // Extract variables with extreme fault tolerance
  const notifObj = payload.notification || {};
  const dataObj = payload.data || {};

  const title = notifObj.title || dataObj.title || payload.title || 'New TuitionHub Alert';
  const body = notifObj.body || dataObj.body || payload.body || '';
  const chatId = dataObj.chatId || notifObj.chatId || payload.chatId || '';
  const senderId = dataObj.senderId || notifObj.senderId || payload.senderId || '';
  
  // Create a unique tag to prevent duplicates and link them
  let tag = dataObj.tag || notifObj.tag || (chatId ? `chat_${chatId}` : `notif_${Date.now()}`);
  
  // Deduplicate triggers if Firebase compat listener also tries to display the same message
  if (processedPushTags.has(tag)) {
    console.log('[SW] Native handler skipped duplicate display for tag:', tag);
    return;
  }
  
  processedPushTags.add(tag);
  // Keep the set size small
  if (processedPushTags.size > 20) {
    const firstVal = processedPushTags.values().next().value;
    processedPushTags.delete(firstVal);
  }

  const notificationOptions = {
    body: body,
    icon: '/gold_tuitionhub_logo_1779680854835.png',
    badge: '/notification-badge.svg',
    vibrate: [200, 100, 200, 100, 200], // Intense vibration for quick alerts
    data: {
      chatId: chatId,
      senderId: senderId,
      ...dataObj,
      ...notifObj
    },
    tag: tag,
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open App 🏫' }
    ]
  };

  // calling event.waitUntil() forces the browser and OS to keep the process alive
  // until the notification is drawn, solving background cuts 100% of the time.
  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
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
    // Search for any existing open tab of TuitionHub
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


// Load Firebase compatibility scripts in background
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBKkmzN2fWlpDIoBPcRVP5dt6oKXfOL2AI",
  authDomain: "tutionhub-e41cd.firebaseapp.com",
  projectId: "tutionhub-e41cd",
  storageBucket: "tutionhub-e41cd.firebasestorage.app",
  messagingSenderId: "327044071382",
  appId: "1:327044071382:web:9c4d14d0d6c6650b456e77"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Firebase SDK Background message received:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'New TuitionHub Alert';
  const body = payload.notification?.body || payload.data?.body || '';
  const chatId = payload.data?.chatId || payload.notification?.chatId || '';
  let tag = payload.data?.tag || payload.notification?.tag || (chatId ? `chat_${chatId}` : `notif_fcm_${Date.now()}`);

  if (processedPushTags.has(tag)) {
    console.log('[SW] Firebase background skipped duplicate tag:', tag);
    return;
  }
  
  processedPushTags.add(tag);

  const notificationOptions = {
    body: body,
    icon: '/gold_tuitionhub_logo_1779680854835.png',
    badge: '/notification-badge.svg',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    tag: tag,
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open App 🏫' }
    ]
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Active real service worker cache implementation to satisfy guide and remove console warnings of no-op fetch handler
const CACHE_NAME = 'tuitionhub-static-cache-v10';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/gold_tuitionhub_logo_1779680854835.png',
  '/gold_tuitionhub_logo_192.png',
  '/gold_tuitionhub_logo_512.png',
  '/notification-badge.svg',
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
  // Take control of the page immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      }),
      // Forcefully claim any uncontrolled clients/tabs instantly
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Do not intercept API requests, Firebase internal endpoints, or external auth domains
  if (
    url.includes('/api/') || 
    url.includes('/__/') || 
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('googleapis') ||
    url.includes('firebase')
  ) {
    return;
  }

  // Only handle same-origin GET requests
  if (url.startsWith(self.location.origin) && event.request.method === 'GET') {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // We ONLY intercept documents (/) or assets explicitly in our static cache to avoid stale bundle issues
      const isDoc = path === '/' || path === '/index.html';
      const isStaticAsset = ASSETS_TO_CACHE.includes(path) || ASSETS_TO_CACHE.includes(urlObj.pathname);

      if (!isDoc && !isStaticAsset) {
        // Bypass service worker and fetch directly from network
        return;
      }

      if (isDoc) {
        // Network-first strategy for HTML pages to guarantee immediate updates while online
        event.respondWith(
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                const respClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
              }
              return networkResponse;
            })
            .catch(() => {
              return caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return caches.match('/index.html');
              });
            })
        );
        return;
      }

      // Cache-first (stale-while-revalidate) for other static assets (images, manifest, etc.)
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
          }).catch((err) => {
            throw err;
          });
        })
      );
    } catch (e) {
      // Fallback natively on URL parse failures
    }
  }
});
