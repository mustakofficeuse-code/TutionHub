importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Version 3 - Fixed double popups and actions

firebase.initializeApp({
  apiKey: "AIzaSyDNC_VlFEwkE32P5CfvvmFI6kB5M3UJNN4",
  authDomain: "tuitionhubapp.firebaseapp.com",
  projectId: "tuitionhubapp",
  storageBucket: "tuitionhubapp.firebasestorage.app",
  messagingSenderId: "1075587061029",
  appId: "1:1075587061029:web:6844b0bdd6118881d0b6cc"
});

const messaging = firebase.messaging();

// Remove manual messaging.onBackgroundMessage to avoid double popups when FCM native SW displays webpush.notification

self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation(); // Important! Prevent FCM's default click handler
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
          if ('focus' in windowClients[i]) {
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