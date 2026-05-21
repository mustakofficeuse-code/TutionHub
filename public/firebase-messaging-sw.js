// Version 8 - Synced & Highly Durable Background Push Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDNC_VlFEwkE32P5CfvvmFI6kB5M3UJNN4",
  authDomain: "tuitionhubapp.firebaseapp.com",
  projectId: "tuitionhubapp",
  storageBucket: "tuitionhubapp.firebasestorage.app",
  messagingSenderId: "1075587061029",
  appId: "1:1075587061029:web:6844b0bdd6118881d0b6cc"
});

const messaging = firebase.messaging();

// Map to prevent rapid-fire dual popup duplications
const recentlyShownNotifications = new Map();

// Listening to the push event to intercept the background messages
self.addEventListener('push', function(event) {
  let title = 'New Notification';
  let body = '';
  let dataObj = {};

  try {
    if (event.data) {
      const rawText = event.data.text();
      try {
        const payload = JSON.parse(rawText);
        console.log('[SW] Intercepted push payload:', payload);

        dataObj = payload.data || {};
        const type = dataObj.type || payload.type || '';

        // Safely extract message details
        title = payload.notification?.title || dataObj.title || payload.title || 'New Notification';
        body = payload.notification?.body || dataObj.body || payload.body || '';
      } catch (jsonErr) {
        // Fallback for non-JSON text payloads
        body = rawText || '';
      }
    }
  } catch (err) {
    console.error('[SW] Extraction failed, using safe defaults:', err);
  }

  // --- DUPLICATE PREVENTION ENGINE ---
  const dedupeKey = `${title}|${body}`;
  const now = Date.now();
  if (recentlyShownNotifications.has(dedupeKey)) {
    const lastShown = recentlyShownNotifications.get(dedupeKey);
    if (now - lastShown < 3000) {
      console.log('[SW] Prevented duplicate browser banner:', title);
      event.stopImmediatePropagation();
      return;
    }
  }
  recentlyShownNotifications.set(dedupeKey, now);

  // Prune cache to keep footprint tiny
  if (recentlyShownNotifications.size > 100) {
    for (const [key, time] of recentlyShownNotifications.entries()) {
      if (now - time > 15000) recentlyShownNotifications.delete(key);
    }
  }

  const notificationTag = dataObj.chatId ? `chat_${dataObj.chatId}` : `notification_${now}`;

  const notificationOptions = {
    body: body,
    icon: self.location.origin + '/logo.png',
    badge: self.location.origin + '/logo.png',
    vibrate: [100, 50, 100],
    data: dataObj,
    tag: notificationTag,
    renotify: true,
    requireInteraction: true
  };

  // --- SYSTEM BANNER GENERATION ENGINE ---
  // Always trigger the OS system banner to guarantee it displays 
  // whether the browser tab is focused, backgrounded, or completely closed.
  const displayPromise = self.registration.showNotification(title, notificationOptions);

  event.waitUntil(displayPromise);
});

// Handling notification action clicks!
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  let targetUrl = '/';
  if ((data.type === 'chat_message' || data.type === 'group_chat_message') && data.chatId) {
    targetUrl = `/?openChatId=${data.chatId}`; 
  }

  const navigatePromise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
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
