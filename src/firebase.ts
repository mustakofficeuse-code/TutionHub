import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with settings that might help in a proxied environment
const firestoreSettings: any = {};
if (typeof window !== 'undefined') {
  // Use long polling if the backend is unreachable via WebSockets
  firestoreSettings.experimentalForceLongPolling = true;
}

export const db = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' && firebaseConfig.firestoreDatabaseId !== '') 
  ? initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId) 
  : initializeFirestore(app, firestoreSettings);

export const storage = getStorage(app);

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
      error.message.includes('Insufficient permissions')
    ))
  )) {
    return; // Suppress these as they are handled in the UI
  }
  console.error(prefix, error);
};

// Connection test - Non-blocking and more resilient
async function testConnection() {
  if (typeof window === 'undefined') return;
  
  try {
    // Try a standard getDoc on a non-existent path to warm up connection
    // This will use the cache if available or try the server
    const testDoc = doc(db, '_connection_check_', 'test');
    await getDoc(testDoc);
    console.log("Firestore initialized successfully");
  } catch (error: any) {
    // We only log if it's clearly a config error
    if (error.code === 'failed-precondition' || (error.message && error.message.includes('apiKey'))) {
      console.warn("Firestore connection check warning:", error.message);
    }
  }
}

testConnection();

export default app;
