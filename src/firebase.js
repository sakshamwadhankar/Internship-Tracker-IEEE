/**
 * Firebase configuration module.
 * 
 * IMPORTANT: Before running, you must set up your own Firebase project:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (or use existing)
 * 3. Enable Authentication → Google sign-in provider
 * 4. Create a Firestore database  
 * 5. Copy your config values into a `.env` file at the project root:
 *
 *    VITE_FIREBASE_API_KEY=your-api-key
 *    VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
 *    VITE_FIREBASE_PROJECT_ID=your-project-id
 *    VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
 *    VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
 *    VITE_FIREBASE_APP_ID=your-app-id
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

/** @type {import('firebase/app').FirebaseOptions} */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate config at startup
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

/** @type {boolean} */
const isConfigured = missingKeys.length === 0;

if (!isConfigured) {
  console.warn(
    `[PTracker] Missing Firebase config keys: ${missingKeys.join(', ')}. ` +
    `App will run in local-only mode. See src/firebase.js for setup instructions.`
  );
}

/** @type {import('firebase/app').FirebaseApp|null} */
let app = null;
/** @type {import('firebase/auth').Auth|null} */
let auth = null;
/** @type {import('firebase/firestore').Firestore|null} */
let db = null;
const googleProvider = isConfigured ? new GoogleAuthProvider() : null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      db = getFirestore(app);
    }
  } catch (error) {
    console.error('[PTracker] Firebase initialization failed:', error);
  }
}

export {
  app,
  auth,
  db,
  isConfigured,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
};

