// Version 4 - Intercept push completely

self.addEventListener('push', function(event) {
  // Prevent FCM from receiving this event and showing a duplicate notification
  event.stopImmediatePropagation();

  if (!event.data) return;

  try {
    const payload = event.data.json();
    console.log('[SW] Intercepted push payload:', payload);

    const dataObj = payload.data || {};
    // Depending on FCM format, the notification might be under payload.notification
    const title = payload.notification?.title || dataObj.title || 'New Notification';
    const body = payload.notification?.body || dataObj.body || '';

    const notificationOptions = {
      body: body,
      icon: '/vite.svg',
      vibrate: [100, 50, 100],
      data: dataObj,
      requireInteraction: true,
    };

    if (dataObj.type === 'chat_message' || dataObj.type === 'group_chat_message') {
      notificationOptions.actions = [
        {
          action: 'reply',
          type: 'text',
          title: 'Reply'
        }
      ];
    }

    event.waitUntil(
      self.registration.showNotification(title, notificationOptions)
    );
  } catch (err) {
    console.error('Error handling push event', err);
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
  event.stopImmediatePropagation(); // Important! Prevent default click handler
  event.notification.close();

  const data = event.notification.data;

  if (event.action === 'reply') {
    const replyText = event.reply;
    
    if (replyText && data) {
      // Send the reply text via an API call
      event.waitUntil(
        fetch('/api/chat-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: replyText,
            chatId: data.chatId,
            recipientId: data.senderId, // The sender of the previous message is the recipient of our reply
            senderId: data.targetId, // The recipient of the previous message is the sender of our reply
            originalType: data.type
          })
        })
      );
    }
  } else {
    // Default open behavior
    let targetUrl = '/';
    if ((data?.type === 'chat_message' || data?.type === 'group_chat_message') && data?.chatId) {
      targetUrl = `/?openChatId=${data.chatId}`; 
    }

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          if (windowClients[i].url && windowClients[i].url.includes(self.registration.scope) && 'focus' in windowClients[i]) {
             // Send message to the app to route internally to the chat
             windowClients[i].postMessage({ type: 'NAVIGATE_TO_CHAT', chatId: data?.chatId, msgType: data?.type });
             return windowClients[i].focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
    );
  }
});