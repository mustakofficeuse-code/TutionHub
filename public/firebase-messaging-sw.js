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
    icon: '/logo.png',
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
