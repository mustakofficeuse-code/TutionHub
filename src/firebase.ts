import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with long polling to prevent proxy-related connection/token drops
const firestoreSettings: any = {
  experimentalForceLongPolling: true,
  useFetchStreams: false
};


// We export db using initializeFirestore to ensure settings apply
export const db = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' && firebaseConfig.firestoreDatabaseId !== '') 
  ? initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId) 
  : initializeFirestore(app, firestoreSettings);

export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;


/**
 * Custom error logger to suppress expected/handled auth errors from the console logs.
 */
export const logError = (prefix: string, error: any) => {
  if (error && (
    error.code === 'auth/invalid-credential' || 
    error.code === 'auth/user-not-found' || 
    error.code === 'auth/wrong-password' ||
    (error.message && (
      error.message.includes('auth/invalid-credential') || 
      error.message.includes('permission-denied') ||
      error.message.includes('Insufficient permissions') ||
      error.message.includes('client is offline') ||
      error.message.includes('failed-precondition')
    ))
  )) {
    // Suppress offline errors if navigator says we are offline, or log as a quiet warning
    if (error.message && error.message.includes('offline')) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      console.warn(`[Offline] ${prefix}`, "Connection lost. Retrying in background...");
    }
    return;
  }
  console.error(prefix, error);
};

// Connection test removed to avoid permission warnings on startup

export default app;
