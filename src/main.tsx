import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Pre-register service worker for reliable background pushes
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
    .then((reg) => {
      console.log('App service worker pre-registered with scope:', reg.scope);
      // Force checking for updates immediately so any logo or notification fixes are applied instantly
      reg.update().catch(err => console.warn('SW update check failed:', err));
    })
    .catch((err) => {
      console.error('App service worker pre-registration failed:', err);
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
