// Version 7 - Advanced Push Interception (Deduplicated & Absolutely Reliable Background Pushes)

// In-memory set to prevent rapid-fire duplicate popups (Duplicate Prevention Engine)
const recentlyShownNotifications = new Map(); // key -> timestamp

self.addEventListener('push', function(event) {
  if (!event.data) return;

  // Intercept push notification immediately to stop FCM's native listener from showing a duplicate popup
  event.stopImmediatePropagation();

  try {
    const payload = event.data.json();
    console.log('[SW] Intercepted push payload:', payload);

    const dataObj = payload.data || {};
    const type = dataObj.type || payload.type || '';

    // Extract title and body robustly from any structural configuration
    const title = payload.notification?.title || dataObj.title || payload.title || 'New Notification';
    const body = payload.notification?.body || dataObj.body || payload.body || '';

    // --- DUPLICATE PREVENTION ENGINE ---
    const dedupeKey = `${title}|${body}`;
    const now = Date.now();
    if (recentlyShownNotifications.has(dedupeKey)) {
      const lastShown = recentlyShownNotifications.get(dedupeKey);
      if (now - lastShown < 3000) { // If received within 3 seconds, discard as a duplicate
        console.log('[SW] Prevented dual popup for duplicate payload:', title);
        return;
      }
    }
    recentlyShownNotifications.set(dedupeKey, now);

    // Garbage collection of recentlyShownMap to prevent memory issues
    if (recentlyShownNotifications.size > 100) {
      for (const [key, time] of recentlyShownNotifications.entries()) {
        if (now - time > 10000) {
          recentlyShownNotifications.delete(key);
        }
      }
    }

    // Assign a native coalescence 'tag' based on chat group or notification type.
    // This instructs the operating system/browser itself to merge any identical items.
    const notificationTag = dataObj.chatId ? `chat_${dataObj.chatId}` : `notification_${type || 'general'}`;

    const notificationOptions = {
      body: body,
      icon: self.location.origin + '/logo.png',
      badge: self.location.origin + '/logo.png',
      vibrate: [100, 50, 100],
      data: dataObj,
      tag: notificationTag,
      renotify: true, // Renotifies if it's a new message in the same category
      requireInteraction: true
    };

    // --- FOREGROUND INTELLIGENT DE-DUPLICATION ---
    // If the app is open and visible in the foreground, we can skip showing the OS-level system banner
    // to avoid bothering the user since onSnapshot plays live chime sound and updates the UI real-time.
    const displayPromise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const isForeground = windowClients.some(client => client.visibilityState === 'visible');
      if (isForeground) {
        console.log('[SW] App is active in foreground. Skipping OS-level banner to prevent dual popups in UI.');
        return;
      }

      // If app is closed, or backgrounded, draw the OS-level notification banner flawlessly and reliably
      return self.registration.showNotification(title, notificationOptions);
    });

    event.waitUntil(displayPromise);
  } catch (err) {
    console.error('[SW] Custom push event processing failed:', err);
  }
});

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

self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();

  const data = event.notification.data;

  // Build target app path
  let targetUrl = '/';
  if ((data?.type === 'chat_message' || data?.type === 'group_chat_message') && data?.chatId) {
    targetUrl = `/?openChatId=${data.chatId}`; 
  }

  const navigatePromise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    // Focus existing opened app instance if available
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url && client.url.includes(self.registration.scope) && 'focus' in client) {
         client.postMessage({ type: 'NAVIGATE_TO_CHAT', chatId: data?.chatId, msgType: data?.type });
         return client.focus();
      }
    }
    // Otherwise open a new window instance of the app
    return clients.openWindow(targetUrl);
  });

  event.waitUntil(navigatePromise);
});
