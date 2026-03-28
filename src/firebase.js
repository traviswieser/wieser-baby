// ─── Firebase Configuration ───────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
  enableIndexedDbPersistence,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             || "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || "YOUR_AUTH_DOMAIN",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || "YOUR_PROJECT_ID",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              || "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// Offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition")
    console.warn("Firestore persistence: multiple tabs open.");
  else if (err.code === "unimplemented")
    console.warn("Firestore persistence: not supported.");
});

// ─── Auth providers ───────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ─── Auth actions ─────────────────────────────────────────────

/** Returns a promise that resolves to the current user (or null). */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user); });
  });
}

/**
 * Sign in with Google.
 * Uses popup on desktop, redirect on mobile (more reliable on iOS/Android).
 */
export async function signInWithGoogle() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    await signInWithRedirect(auth, googleProvider);
    return null; // page will reload; catch result in checkRedirectResult()
  }
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

/** Call once on app load to catch the result of a Google redirect sign-in. */
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch {
    return null;
  }
}

/** Register a new user with email + password. displayName is optional. */
export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  return cred.user;
}

/** Sign in an existing user with email + password. */
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** Send a password-reset email. */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/** Sign out the current user. */
export async function logOut() {
  await signOut(auth);
}

// ─── Legacy helper (kept for backward compat in App.jsx) ──────
export async function ensureSignedIn() {
  const user = await getCurrentUser();
  if (user) return user.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

// ─── Firestore data helpers ───────────────────────────────────
export function getUserDocRef(uid) {
  return doc(db, "users", uid, "data", "main");
}

export async function loadUserData(uid) {
  const LOCAL_KEY = `wieser-baby-data-${uid}`;
  try {
    const snap = await getDoc(getUserDocRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
      return data;
    }
    return null;
  } catch {
    const local = localStorage.getItem(LOCAL_KEY);
    return local ? JSON.parse(local) : null;
  }
}

export async function saveUserData(uid, data) {
  const LOCAL_KEY = `wieser-baby-data-${uid}`;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  try {
    await setDoc(getUserDocRef(uid), data, { merge: true });
  } catch (err) {
    console.warn("Firestore save failed (offline?):", err.message);
  }
}

export function subscribeToUserData(uid, onData) {
  return onSnapshot(getUserDocRef(uid), (snap) => {
    if (snap.exists()) onData(snap.data());
  }, (err) => {
    console.warn("Firestore snapshot error:", err.message);
  });
}

/**
 * Update the current user's photo URL and/or display name in Firebase Auth.
 * Accepts a base64 data-URL for photoURL.
 */
export async function updateUserProfile({ displayName, photoURL } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user signed in");
  const update = {};
  if (displayName !== undefined) update.displayName = displayName;
  if (photoURL     !== undefined) update.photoURL     = photoURL;
  await updateProfile(user, update);
  return auth.currentUser;
}
