// ─── Firebase Configuration ───────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
  enableIndexedDbPersistence, collection, addDoc,
  query, where, getDocs, updateDoc, arrayUnion,
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

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") console.warn("Firestore persistence: multiple tabs open.");
  else if (err.code === "unimplemented")  console.warn("Firestore persistence: not supported.");
});

// ─── Auth providers ───────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ─── Auth actions ─────────────────────────────────────────────
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user); });
  });
}

export async function signInWithGoogle() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) { await signInWithRedirect(auth, googleProvider); return null; }
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function checkRedirectResult() {
  try { const r = await getRedirectResult(auth); return r?.user ?? null; } catch { return null; }
}

export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logOut() {
  await signOut(auth);
}

export async function ensureSignedIn() {
  const user = await getCurrentUser();
  if (user) return user.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export async function updateUserProfile({ displayName, photoURL } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user signed in");
  const update = {};
  if (displayName !== undefined) update.displayName = displayName;
  if (photoURL     !== undefined) update.photoURL     = photoURL;
  await updateProfile(user, update);
  return auth.currentUser;
}

// ─── Household helpers ────────────────────────────────────────
// Data is stored at ONE of two paths depending on whether the user
// is in a household or not:
//   Solo:      users/{uid}/data/main
//   Household: households/{householdId}/data/main
//
// We track which path to use in:
//   localStorage key: wieser-baby-household-{uid}  →  { householdId }

const HOUSEHOLD_LS_KEY = (uid) => `wieser-baby-household-${uid}`;

/** Returns the householdId for this user, or null if solo. */
export function getStoredHouseholdId(uid) {
  try {
    const val = localStorage.getItem(HOUSEHOLD_LS_KEY(uid));
    return val ? JSON.parse(val).householdId : null;
  } catch { return null; }
}

function setStoredHouseholdId(uid, householdId) {
  localStorage.setItem(HOUSEHOLD_LS_KEY(uid), JSON.stringify({ householdId }));
}

/** Returns the Firestore data doc ref — household path if in one, solo path otherwise. */
export function getDataDocRef(uid, householdId) {
  if (householdId) return doc(db, "households", householdId, "data", "main");
  return doc(db, "users", uid, "data", "main");
}

/** Generates a random 6-char uppercase invite code. */
function makeInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Creates a new household for the current user.
 * Returns { householdId, inviteCode }.
 */
export async function createHousehold(uid, displayName) {
  const inviteCode = makeInviteCode();
  const householdRef = await addDoc(collection(db, "households"), {
    memberUids:   [uid],
    memberNames:  [displayName || "Partner 1"],
    inviteCode,
    createdAt:    new Date().toISOString(),
    createdBy:    uid,
  });
  setStoredHouseholdId(uid, householdRef.id);
  return { householdId: householdRef.id, inviteCode };
}

/**
 * Joins an existing household by invite code.
 * Returns { householdId } on success, throws on bad code.
 */
export async function joinHousehold(uid, displayName, inviteCode) {
  const code = inviteCode.trim().toUpperCase();
  const q = query(collection(db, "households"), where("inviteCode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Invalid invite code. Double-check and try again.");

  const householdDoc = snap.docs[0];
  const householdId  = householdDoc.id;
  const existing     = householdDoc.data();

  if (existing.memberUids.includes(uid)) {
    // Already a member — just re-link locally
    setStoredHouseholdId(uid, householdId);
    return { householdId };
  }

  if (existing.memberUids.length >= 6) {
    throw new Error("This household already has the maximum number of members.");
  }

  // Add this user to the household members list
  await updateDoc(doc(db, "households", householdId), {
    memberUids:  arrayUnion(uid),
    memberNames: arrayUnion(displayName || "Partner 2"),
  });

  setStoredHouseholdId(uid, householdId);
  return { householdId };
}

/**
 * Leaves the current household (removes local link only — data stays in Firestore).
 * The user goes back to their private solo data path.
 */
export function leaveHousehold(uid) {
  localStorage.removeItem(HOUSEHOLD_LS_KEY(uid));
}

/**
 * Fetches the household document (member names, invite code, etc.)
 */
export async function getHouseholdInfo(householdId) {
  const snap = await getDoc(doc(db, "households", householdId));
  return snap.exists() ? { id: householdId, ...snap.data() } : null;
}

// ─── Data helpers (household-aware) ──────────────────────────
export async function loadUserData(uid) {
  const householdId = getStoredHouseholdId(uid);
  const LOCAL_KEY   = householdId
    ? `wieser-baby-data-household-${householdId}`
    : `wieser-baby-data-${uid}`;

  try {
    const snap = await getDoc(getDataDocRef(uid, householdId));
    if (snap.exists()) {
      const data = snap.data();
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
      return data;
    }
    // New household member — try migrating solo data across
    if (householdId) {
      const soloSnap = await getDoc(getDataDocRef(uid, null));
      if (soloSnap.exists()) return soloSnap.data(); // caller will save to household path
    }
    return null;
  } catch {
    const local = localStorage.getItem(LOCAL_KEY);
    return local ? JSON.parse(local) : null;
  }
}

export async function saveUserData(uid, data) {
  const householdId = getStoredHouseholdId(uid);
  const LOCAL_KEY   = householdId
    ? `wieser-baby-data-household-${householdId}`
    : `wieser-baby-data-${uid}`;

  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  try {
    await setDoc(getDataDocRef(uid, householdId), data, { merge: true });
  } catch (err) {
    console.warn("Firestore save failed (offline?):", err.message);
  }
}

export function subscribeToUserData(uid, onData) {
  const householdId = getStoredHouseholdId(uid);
  return onSnapshot(getDataDocRef(uid, householdId), (snap) => {
    if (snap.exists()) onData(snap.data());
  }, (err) => {
    console.warn("Firestore snapshot error:", err.message);
  });
}
