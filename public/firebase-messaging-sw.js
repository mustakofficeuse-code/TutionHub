// Synced & Highly Durable Background Push Service Worker
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

// Cache to prevent duplicate simultaneous popups in short timeframes
const recentlyShown = new Set();

// Handle background messages with Firebase's optimized compat SDK handler
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background notification received:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'New TuitionHub Alert';
  const body = payload.notification?.body || payload.data?.body || '';
  
  const hashKey = `${title}|${body}`;
  if (recentlyShown.has(hashKey)) return;
  recentlyShown.add(hashKey);
  setTimeout(() => recentlyShown.delete(hashKey), 4000);

  const dataObj = payload.data || {};
  const notificationTag = dataObj.chatId ? `chat_${dataObj.chatId}` : `notification_${Date.now()}`;

  const notificationOptions = {
    body: body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [100, 50, 100],
    data: dataObj,
    tag: notificationTag,
    renotify: true,
    requireInteraction: true
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Fallback manual push event handler for non-FCM browsers
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const rawText = event.data.text();
    const payload = JSON.parse(rawText);
    
    // If it's a standard FCM direct background push, FCM will handle it via onBackgroundMessage.
    // If it's a legacy system push, we handle it here.
    const title = payload.notification?.title || payload.data?.title || payload.title || 'New Alert';
    const body = payload.notification?.body || payload.data?.body || payload.body || '';

    const hashKey = `${title}|${body}`;
    if (recentlyShown.has(hashKey)) return;
    recentlyShown.add(hashKey);
    setTimeout(() => recentlyShown.delete(hashKey), 4000);

    const notificationOptions = {
      body: body,
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [100, 50, 100],
      data: payload.data || {},
      requireInteraction: true
    };

    event.waitUntil(self.registration.showNotification(title, notificationOptions));
  } catch (e) {
    console.log('[SW] Handled raw push message stream:', event.data.text());
  }
});

// Handle background notification clicks to focus or open the correct window
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
