// ─── Firebase Configuration ───────────────────────────────────
// Replace the values below with your actual Firebase project config.
// Get them from: Firebase Console → Project Settings → Your Apps → Web App
//
// ⚠️  NEVER commit real API keys to a public repo.
//     For Netlify deployment, set these as environment variables:
//     VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc.
//     Then reference them here as import.meta.env.VITE_FIREBASE_*

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "YOUR_AUTH_DOMAIN",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "YOUR_PROJECT_ID",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "YOUR_MESSAGING_SENDER_ID",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "YOUR_APP_ID",
};

// ─── Initialize ───────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence (so the app works without internet)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Firestore persistence: multiple tabs open — persistence only enabled in one tab at a time.");
  } else if (err.code === "unimplemented") {
    console.warn("Firestore persistence: not supported in this browser.");
  }
});

// ─── Auth helpers ─────────────────────────────────────────────
/** Signs the user in anonymously (no email/password needed). Returns the uid. */
export async function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) {
        resolve(user.uid);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user.uid);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

// ─── Data helpers ─────────────────────────────────────────────
/** Returns the Firestore document reference for a user's baby data. */
export function getUserDocRef(uid) {
  return doc(db, "users", uid, "data", "main");
}

/**
 * Loads a user's data from Firestore. Falls back to localStorage if offline.
 * Returns the parsed data object, or null if none exists yet.
 */
export async function loadUserData(uid) {
  const LOCAL_KEY = `wieser-baby-data-${uid}`;
  try {
    const snap = await getDoc(getUserDocRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      // Keep localStorage in sync for fast offline access
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
      return data;
    }
    return null;
  } catch {
    // Offline — try localStorage
    const local = localStorage.getItem(LOCAL_KEY);
    return local ? JSON.parse(local) : null;
  }
}

/**
 * Saves a user's data to Firestore (merge: true so partial writes are safe).
 * Also writes to localStorage as an offline fallback.
 */
export async function saveUserData(uid, data) {
  const LOCAL_KEY = `wieser-baby-data-${uid}`;
  // Always write to localStorage first (fast + offline fallback)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  try {
    await setDoc(getUserDocRef(uid), data, { merge: true });
  } catch (err) {
    console.warn("Firestore save failed (offline?), data saved to localStorage:", err.message);
  }
}

/**
 * Subscribes to real-time updates from Firestore.
 * Calls onData(data) whenever another caregiver updates the data.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeToUserData(uid, onData) {
  return onSnapshot(getUserDocRef(uid), (snap) => {
    if (snap.exists()) {
      onData(snap.data());
    }
  }, (err) => {
    console.warn("Firestore snapshot error:", err.message);
  });
}
