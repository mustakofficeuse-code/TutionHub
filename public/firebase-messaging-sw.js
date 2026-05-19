importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Version 2 - Added inline reply feature

firebase.initializeApp({
  apiKey: "AIzaSyDNC_VlFEwkE32P5CfvvmFI6kB5M3UJNN4",
  authDomain: "tuitionhubapp.firebaseapp.com",
  projectId: "tuitionhubapp",
  storageBucket: "tuitionhubapp.firebasestorage.app",
  messagingSenderId: "1075587061029",
  appId: "1:1075587061029:web:6844b0bdd6118881d0b6cc"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  let notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body,
    icon: '/vite.svg',
    vibrate: [100, 50, 100],
    data: payload.data || {},
  };

  if (payload.data?.type === 'chat_message' || payload.data?.type === 'group_chat_message') {
    notificationOptions.actions = [
      {
        action: 'reply',
        type: 'text',
        title: 'Reply'
      }
    ];
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'reply') {
    const replyText = event.reply;
    const data = event.notification.data;

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
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        if (windowClients.length > 0) {
          windowClients[0].focus();
        } else {
          clients.openWindow('/');
        }
      })
    );
  }
});