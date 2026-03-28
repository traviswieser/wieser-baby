import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, PieChart, Pie, Cell } from "recharts";
import { ensureSignedIn, loadUserData, saveUserData, subscribeToUserData, logOut, getCurrentUser, checkRedirectResult, updateUserProfile } from "./firebase.js";
import AuthScreen from "./AuthScreen.jsx";
import HouseholdSync from "./HouseholdSync.jsx";
import BarcodeScanner from "./BarcodeScanner.jsx";
import { requestNotificationPermission, getNotificationPermission, syncReminders, cancelAllReminders, cancelNapReminders, cancelMedicineReminders, setRemindersRef } from "./notifications.js";
import { DocUploadButton, DocGallery } from "./DocUpload.jsx";

// ─── Constants & Config ───────────────────────────────────────
const APP_VERSION = "1.3.0";
const THEMES = {
  midnight: { bg: "#07080d", card: "#12141c", cardHover: "#1a1d28", border: "#1e2130", accent: "#f4845f", accentSoft: "rgba(244,132,95,0.15)", text: "#e8e6e3", textMuted: "#7a7d8c", success: "#88d8b0", warning: "#f6ae2d", info: "#7eb8da", purple: "#b8a9c9", name: "Midnight", dark: true },
  ocean: { bg: "#060d14", card: "#0c1a28", cardHover: "#122234", border: "#1a2e42", accent: "#4fc3f7", accentSoft: "rgba(79,195,247,0.15)", text: "#dce8f0", textMuted: "#5a7a90", success: "#81c784", warning: "#ffb74d", info: "#64b5f6", purple: "#ab99c7", name: "Ocean", dark: true },
  forest: { bg: "#080d08", card: "#111a11", cardHover: "#182218", border: "#1e2e1e", accent: "#8bc34a", accentSoft: "rgba(139,195,74,0.15)", text: "#dce8dc", textMuted: "#5a7a5a", success: "#a5d6a7", warning: "#dce775", info: "#80cbc4", purple: "#b39ddb", name: "Forest", dark: true },
  galaxy: { bg: "#0a0520", card: "#130c38", cardHover: "#1c1350", border: "#261a5e", accent: "#a78bfa", accentSoft: "rgba(167,139,250,0.18)", text: "#e8e3f8", textMuted: "#7e6fac", success: "#6ee7b7", warning: "#fbbf24", info: "#60a5fa", purple: "#c084fc", name: "Galaxy", dark: true },
  blossom: { bg: "#faf5f2", card: "#ffffff", cardHover: "#fef7f4", border: "#f0e4de", accent: "#e8766a", accentSoft: "rgba(232,118,106,0.12)", text: "#2d2420", textMuted: "#8a7e78", success: "#6dbd8a", warning: "#e8a84c", info: "#6ba3c4", purple: "#a18dbf", name: "Blossom", dark: false },
  sky: { bg: "#f0f7ff", card: "#ffffff", cardHover: "#e8f4ff", border: "#cde4f8", accent: "#2196f3", accentSoft: "rgba(33,150,243,0.12)", text: "#1a2c3d", textMuted: "#6b8aaa", success: "#43a047", warning: "#f59f00", info: "#039be5", purple: "#7c5cbf", name: "Sky", dark: false },
  lavender: { bg: "#f5f3fa", card: "#ffffff", cardHover: "#eee9f8", border: "#ddd5f0", accent: "#7c5cbf", accentSoft: "rgba(124,92,191,0.12)", text: "#211a36", textMuted: "#8676a6", success: "#5aab74", warning: "#e09c2a", info: "#5b9bd5", purple: "#7c5cbf", name: "Lavender", dark: false },
  mint: { bg: "#f0faf6", card: "#ffffff", cardHover: "#e4f7ee", border: "#c3e8d4", accent: "#2e8b5a", accentSoft: "rgba(46,139,90,0.12)", text: "#142b20", textMuted: "#5c8a70", success: "#2e8b5a", warning: "#d97706", info: "#0891b2", purple: "#7c6bbf", name: "Mint", dark: false },
};

// Get the best default theme based on system preference
function getAutoTheme() {
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "midnight" : "blossom";
}

const NAV_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "Home" },
  { id: "trends", icon: "📊", label: "Trends" },
  { id: "food", icon: "🍎", label: "Food" },
  { id: "milestones", icon: "⭐", label: "Stars" },
  { id: "copilot", icon: "🤖", label: "AI" },
  { id: "settings", icon: "⚙️", label: "More" },
];

const MILESTONE_CATEGORIES = {
  motor: { label: "Motor Skills", icon: "🏃", items: ["Holds head up","Rolls over","Sits unassisted","Crawls","Pulls to stand","Cruises furniture","First steps","Walks independently","Runs","Climbs stairs","Jumps with both feet","Pedals tricycle","Catches a ball","Hops on one foot"] },
  speech: { label: "Speech & Language", icon: "🗣️", items: ["First coo","Babbles","Responds to name","Says mama/dada","First word","2-word phrases","50+ words","Short sentences","Asks why","Tells a story","Knows colors","Counts to 10","Sings songs"] },
  social: { label: "Social & Emotional", icon: "💛", items: ["Social smile","Laughs out loud","Stranger anxiety","Waves bye-bye","Plays peekaboo","Shows affection","Parallel play","Shares toys","Takes turns","Makes friends","Shows empathy","Follows rules"] },
  cognitive: { label: "Cognitive", icon: "🧠", items: ["Tracks objects","Reaches for toys","Object permanence","Stacks blocks","Simple puzzles","Sorts shapes","Pretend play","Matches colors","Draws a circle","Writes name","Recognizes letters","Counts objects"] },
  selfcare: { label: "Self-Care", icon: "🪥", items: ["Holds bottle","Finger foods","Drinks from cup","Uses spoon","Uses fork","Potty training starts","Daytime dry","Nighttime dry","Brushes teeth","Dresses self","Ties shoes","Buttons clothes"] },
};

// ─── POOP ANALYSIS DATA ───────────────────────────────────────
const POOP_COLORS = [
  { id: "yellow", hex: "#d4a017", label: "Yellow", health: "Normal - typical for breastfed babies", status: "healthy" },
  { id: "mustard", hex: "#c8a951", label: "Mustard", health: "Normal - classic breastfed baby poop", status: "healthy" },
  { id: "brown", hex: "#8B4513", label: "Brown", health: "Normal - typical for formula-fed or solid food eaters", status: "healthy" },
  { id: "tan", hex: "#c8ad7f", label: "Tan/Khaki", health: "Normal - common with formula feeding", status: "healthy" },
  { id: "green", hex: "#4a7c3f", label: "Green", health: "Usually normal - can indicate fast digestion, iron supplements, or green veggies", status: "watch" },
  { id: "dark_green", hex: "#1a3c12", label: "Dark Green", health: "Normal in first days (meconium) or with iron supplements. If persistent, mention to pediatrician", status: "watch" },
  { id: "orange", hex: "#e07020", label: "Orange", health: "Normal - often from beta-carotene foods like carrots or sweet potatoes", status: "healthy" },
  { id: "red", hex: "#c0392b", label: "Red", health: "Could be from red foods (beets, tomatoes) OR blood. If not food-related, call pediatrician", status: "alert" },
  { id: "black", hex: "#1a1a1a", label: "Black", health: "Normal in first days (meconium). After that, could indicate upper GI bleeding - call pediatrician", status: "alert" },
  { id: "white", hex: "#f0ece0", label: "White/Chalky", health: "May indicate a liver or bile duct issue. Contact your pediatrician promptly", status: "alert" },
];

const POOP_CONSISTENCIES = [
  { id: "liquid", label: "Liquid/Watery", emoji: "💧", health: "May indicate diarrhea if frequent. Monitor hydration closely.", status: "watch" },
  { id: "runny", label: "Runny/Loose", emoji: "🌊", health: "Common for breastfed babies. If formula-fed and persistent, may indicate sensitivity.", status: "healthy" },
  { id: "mushy", label: "Mushy/Soft", emoji: "🍦", health: "Normal and healthy! Ideal consistency for babies and toddlers.", status: "healthy" },
  { id: "peanut_butter", label: "Peanut Butter", emoji: "🥜", health: "Normal - thick and smooth. Very common with formula feeding.", status: "healthy" },
  { id: "seedy", label: "Seedy/Grainy", emoji: "🌱", health: "Perfectly normal for breastfed babies! Seeds are milk fat curds.", status: "healthy" },
  { id: "formed", label: "Formed/Soft Log", emoji: "🪵", health: "Normal for babies on solids and toddlers.", status: "healthy" },
  { id: "firm", label: "Firm/Hard", emoji: "🪨", health: "May indicate constipation. Increase fluids and fiber.", status: "watch" },
  { id: "pellets", label: "Pellets/Pebbles", emoji: "⚫", health: "Sign of constipation. Stool staying too long in colon. Increase fluids.", status: "alert" },
  { id: "clumpy", label: "Clumpy/Lumpy", emoji: "🧱", health: "Mildly constipated. More water and fiber-rich foods may help.", status: "watch" },
  { id: "mucousy", label: "Mucousy/Slimy", emoji: "🫧", health: "Small amounts normal. Large amounts could indicate infection or allergy.", status: "watch" },
  { id: "frothy", label: "Frothy/Foamy", emoji: "🫧", health: "Can indicate foremilk/hindmilk imbalance or lactose sensitivity.", status: "watch" },
];

const POOP_AMOUNTS = [
  { id: "small", label: "Small", emoji: "·" },
  { id: "medium", label: "Medium", emoji: "●" },
  { id: "large", label: "Large", emoji: "⬤" },
  { id: "blowout", label: "Blowout!", emoji: "💥" },
];


// ─── Bottle nutrition per oz by feed type ────────────────────────────────────
const BOTTLE_NUTRITION_PER_OZ = {
  formula:     { calories: 20, protein: 0.5, carbs: 2.1, fat: 1.1, fiber: 0, sugar: 2.1 },
  breast:      { calories: 20, protein: 0.3, carbs: 2.1, fat: 1.2, fiber: 0, sugar: 2.1 },
  milk:        { calories: 18, protein: 1.0, carbs: 1.4, fat: 1.0, fiber: 0, sugar: 1.4 }, // whole milk
  water:       { calories: 0,  protein: 0,   carbs: 0,   fat: 0,   fiber: 0, sugar: 0   },
  juice:       { calories: 14, protein: 0,   carbs: 3.5, fat: 0,   fiber: 0, sugar: 3.2 },
};

function bottleNutrition(feedType, oz) {
  const base = BOTTLE_NUTRITION_PER_OZ[feedType] || BOTTLE_NUTRITION_PER_OZ.milk;
  const round1 = (n) => Math.round(n * oz * 10) / 10;
  return {
    calories: Math.round(base.calories * oz),
    protein:  round1(base.protein),
    carbs:    round1(base.carbs),
    fat:      round1(base.fat),
    fiber:    0,
    sugar:    round1(base.sugar),
  };
}

const DEFAULT_BABY = { name: "Baby", birthDate: "", photo: "" };

// ─── Helpers ──────────────────────────────────────────────────
const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const localTimeStr = (d = new Date()) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const formatTime12 = (t) => { if (!t) return ""; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };
const daysOld = (bd) => { if (!bd) return null; return Math.floor((Date.now() - new Date(bd).getTime()) / 86400000); };
const ageString = (bd) => {
  if (!bd) return "";
  const days = daysOld(bd);
  if (days < 0) return "Not born yet";
  const y = Math.floor(days / 365.25), mo = Math.floor((days % 365.25) / 30.44), d = Math.floor(days % 30.44);
  if (y > 0) return `${y}y ${mo}m`;
  if (mo > 0) return `${mo}m ${d}d`;
  return `${d} day${d !== 1 ? 's' : ''} old`;
};
const last7Days = () => Array.from({length: 7}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return localDateStr(d); });
const dayLabel = (ds) => new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const getLastName = (user) => {
  if (!user) return "Wieser";
  const name = user.displayName || "";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : (name || "Wieser");
};


// ─── Serving size number parser ──────────────────────────────────────────────
// Extracts the leading numeric value from strings like "2 cups", "1/2", "3 oz"
function parseServingNum(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Handle fractions like "1/2" or "1/4"
  const frac = s.match(/^(\d+)\/(\d+)/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  // Handle mixed numbers like "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  // Handle plain numbers or "2 oz", "3 cups" etc.
  const plain = s.match(/^([\d.]+)/);
  if (plain) return parseFloat(plain[1]);
  return null;
}

// ─── Predictive Sleep Windows ────────────────────────────────
/**
 * Analyses past sleep logs and returns a prediction object:
 *  { nextSleepTime, avgNapDuration, avgNapCount, confidence, message }
 */
function predictNextSleep(logs, now) {
  const sleepLogs = logs
    .filter(l => l.type === "sleep" && l.subtype === "woke_up" && l.durationMins && l.time)
    .sort((a, b) => b.timestamp?.localeCompare(a.timestamp ?? "") ?? 0)
    .slice(0, 20); // use last 20 sleep entries

  if (sleepLogs.length < 3) {
    return { message: "Log at least 3 sleeps to see predictions", confidence: 0 };
  }

  // Average wake-window (time between waking and next sleep onset)
  // Since we only store wake events, we approximate the next sleep
  // as (average awake duration) after the last wake time.
  const durations = sleepLogs.map(l => l.durationMins);
  const avgNapDuration = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);

  // Find typical awake windows by looking at gaps between sleep end and next sleep start
  const wakeWindows = [];
  for (let i = 0; i < sleepLogs.length - 1; i++) {
    const curr = sleepLogs[i];
    const next = sleepLogs[i + 1];
    if (curr.date && curr.time && next.date && next.time) {
      const currEnd  = new Date(`${curr.date}T${curr.time}`);
      const nextStart = new Date(`${next.date}T${next.time}`);
      const gapMins = (currEnd - nextStart) / 60000;
      if (gapMins > 30 && gapMins < 360) wakeWindows.push(gapMins); // 30min–6hr is plausible
    }
  }

  const avgAwakeMins = wakeWindows.length > 0
    ? Math.round(wakeWindows.reduce((s, w) => s + w, 0) / wakeWindows.length)
    : 120; // default 2 hours if not enough data

  // Last wake time
  const lastWake = sleepLogs[0];
  const lastWakeTime = lastWake ? new Date(`${lastWake.date}T${lastWake.time}`) : now;
  const predictedSleepTime = new Date(lastWakeTime.getTime() + avgAwakeMins * 60000);

  const minsUntil = Math.round((predictedSleepTime - now) / 60000);
  const confidence = wakeWindows.length >= 5 ? "high" : wakeWindows.length >= 3 ? "medium" : "low";

  let message;
  if (minsUntil <= 0) {
    message = `Baby may be ready to sleep now (avg awake window: ${avgAwakeMins}m)`;
  } else if (minsUntil < 60) {
    message = `Next sleep in ~${minsUntil} min`;
  } else {
    const hrs = Math.floor(minsUntil / 60), mins = minsUntil % 60;
    message = `Next sleep in ~${hrs}h${mins > 0 ? ` ${mins}m` : ""}`;
  }

  return {
    predictedSleepTime,
    avgNapDuration,
    avgAwakeMins,
    minsUntil,
    confidence,
    message,
    timeStr: predictedSleepTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

// ─── Storage (Firebase + localStorage fallback) ───────────────
let _uid = null;
const getUid = async () => { if (!_uid) _uid = await ensureSignedIn(); return _uid; };
const loadData = async () => { try { const uid = await getUid(); return await loadUserData(uid); } catch { return null; } };
const saveData = async (data) => { try { const uid = await getUid(); await saveUserData(uid, data); } catch (e) { console.error("Save failed:", e); } };

const DEFAULT_DATA = {
  // Multi-baby: activeBabyId points to one entry in babies[]
  // Legacy single-baby data is migrated on first load (see migrateData below)
  activeBabyId: "baby_1",
  babies: [{ id: "baby_1", ...DEFAULT_BABY }],
  baby: { ...DEFAULT_BABY },  // kept for backward compat — mirrors active baby
  logs: [], milestones: {}, growthRecords: [],
  settings: { theme: "auto", aiProvider: "groq", aiKey: "", familyMembers: [] },
  familyUpdates: [], sleepState: null, pediatricianNotes: [],
  foodPreferences: { likes: [], dislikes: [] },
};

// Migrate old single-baby data to multi-baby format
const migrateData = (d) => {
  if (!d) return d;
  if (!d.babies) {
    const babyId = "baby_1";
    return { ...d, activeBabyId: babyId, babies: [{ id: babyId, ...(d.baby || DEFAULT_BABY) }] };
  }
  return d;
};

// Return only the logs / records belonging to the active baby
const filterForBaby = (d, babyId) => ({
  ...d,
  logs:          (d.logs          || []).filter(l => !l.babyId || l.babyId === babyId),
  growthRecords: (d.growthRecords || []).filter(r => !r.babyId || r.babyId === babyId),
  milestones:    Object.fromEntries(Object.entries(d.milestones || {}).filter(([k]) => !k.startsWith("b:") || k.startsWith(`b:${babyId}:`))),
  foodPreferences: (d.foodPreferences?.[babyId]) || (d.foodPreferences?.likes ? d.foodPreferences : { likes: [], dislikes: [] }),
  sleepState:    d.sleepStates?.[babyId] ?? d.sleepState ?? null,
});

const DEFAULT_REMINDERS = {
  feedingEnabled: false,
  feedingMins: 180,
  medicineEnabled: false,
  medicineTimes: ["08:00", "12:00", "18:00"],
  napEnabled: false,
  napTimes: ["09:00", "13:00"],
  dndEnabled: false,
  dndStart: "21:00",
  dndEnd: "07:00",
};


// ─── Per-user theme (localStorage, never synced to Firestore) ────────────────
const THEME_LS_KEY = (uid) => uid ? `wieser-baby-theme-${uid}` : "wieser-baby-theme-guest";
const getUserTheme = (uid) => {
  try { return localStorage.getItem(THEME_LS_KEY(uid)) || "auto"; } catch { return "auto"; }
};
const setUserTheme = (uid, theme) => {
  try { localStorage.setItem(THEME_LS_KEY(uid), theme); } catch {}
};

// ─── Splash theme helper ─────────────────────────────────────
// Reads the last-used theme from localStorage so the splash screen
// matches the user's chosen theme before data has loaded.
function getSplashTheme() {
  try {
    // Check per-user theme keys first (format: wieser-baby-theme-{uid})
    const themeKeys = Object.keys(localStorage).filter(k => k.startsWith("wieser-baby-theme-"));
    for (const key of themeKeys) {
      const t = localStorage.getItem(key);
      if (t && t !== "auto" && THEMES[t]) return THEMES[t];
    }
    // Fall back to old data-embedded theme for backwards compat
    const dataKeys = Object.keys(localStorage).filter(k => k.startsWith("wieser-baby-data"));
    for (const key of dataKeys) {
      const d = JSON.parse(localStorage.getItem(key) || "null");
      if (d?.settings?.theme && d.settings.theme !== "auto" && THEMES[d.settings.theme]) {
        return THEMES[d.settings.theme];
      }
    }
  } catch {}
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  return prefersDark ? THEMES.midnight : THEMES.blossom;
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function WieserBabyApp() {
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = signed out
  const [page, setPage] = useState("dashboard");
  const [pageHistory, setPageHistory] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(new Date());
  const [reminders, setReminders] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wieser-baby-reminders") || "null") || DEFAULT_REMINDERS; }
    catch { return DEFAULT_REMINDERS; }
  });
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission);

  const [sysDark, setSysDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSysDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  // Per-user theme stored in localStorage — read on mount, keyed to UID
  const [userThemeKey, setUserThemeKey] = useState(() =>
    getUserTheme(currentUser?.uid || null)
  );
  // When user changes, reload their theme preference
  useEffect(() => {
    setUserThemeKey(getUserTheme(currentUser?.uid || null));
  }, [currentUser?.uid]);

  const resolvedThemeKey = (() => {
    const t = userThemeKey || "auto";
    if (t === "auto") return sysDark ? "midnight" : "blossom";
    return THEMES[t] ? t : (sysDark ? "midnight" : "blossom");
  })();
  const theme = THEMES[resolvedThemeKey];

  // Multi-baby helpers
  const activeBabyId = data?.activeBabyId || "baby_1";
  const activeBaby   = data?.babies?.find(b => b.id === activeBabyId) || data?.baby || DEFAULT_BABY;
  const switchBaby   = (babyId) => setData(d => ({ ...d, activeBabyId: babyId, baby: d.babies.find(b => b.id === babyId) || DEFAULT_BABY }));
  const addBaby      = (name, birthDate) => {
    const newId = "baby_" + uid();
    const newBaby = { id: newId, name, birthDate, photo: "" };
    setData(d => ({ ...d, babies: [...(d.babies || []), newBaby], activeBabyId: newId, baby: newBaby }));
    showToast("👶 " + name + " added!");
  };

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);

  // Check auth state on mount, then load data
  useEffect(() => {
    let unsub = null;
    let dataUnsub = null;
    (async () => {
      // Handle Google redirect result first (mobile OAuth flow)
      await checkRedirectResult();
      // Get current auth state
      const user = await getCurrentUser();
      setCurrentUser(user); // null = not signed in, object = signed in
      if (!user) { setLoading(false); return; }

      const raw = await loadData();
      const d = migrateData(raw) || JSON.parse(JSON.stringify(DEFAULT_DATA));
      setData(d);
      setLoading(false);

      const uid = await getUid();
      dataUnsub = subscribeToUserData(uid, (fresh) => {
        setData(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(fresh)) return fresh;
          return prev;
        });
      });
    })();
    return () => { if (dataUnsub) dataUnsub(); };
  }, []);

  useEffect(() => { if (data && !loading) saveData(data); }, [data, loading]);

  const navigate = useCallback((p) => { setPageHistory(h => [...h, page]); setPage(p); }, [page]);
  const navigateBack = useCallback(() => { setPageHistory(h => { const n = [...h]; const prev = n.pop() || "dashboard"; setPage(prev); return n; }); }, []);
  useEffect(() => { const handler = (e) => { e.preventDefault(); navigateBack(); }; window.addEventListener("popstate", handler); return () => window.removeEventListener("popstate", handler); }, [navigateBack]);

  // Sync reminders whenever settings change
  useEffect(() => {
    localStorage.setItem("wieser-baby-reminders", JSON.stringify(reminders));
    if (data) {
      setRemindersRef(reminders); // keep DND ref fresh
      syncReminders(data, reminders); // handles feeding + nap + medicine
    }
  }, [reminders, data]);

  // Cleanup all reminders on unmount
  useEffect(() => () => { cancelAllReminders(); cancelNapReminders(); cancelMedicineReminders(); }, []);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  // Called when user joins/leaves a household so data reloads from the new path
  const handleHouseholdChange = () => {
    setData(null);
    setLoading(true);
    getUid().then(uid => {
      loadUserData(uid).then(raw => {
        const d = migrateData(raw) || JSON.parse(JSON.stringify(DEFAULT_DATA));
        setData(d);
        setLoading(false);
      });
    });
  };
  const addLog = (log) => {
    setData(d => ({ ...d, logs: [...d.logs, { ...log, id: uid(), babyId: d.activeBabyId || "baby_1", timestamp: new Date().toISOString() }] }));
    const icons = { bottle: '🍼', diaper: '💧', sleep: '😴', medicine: '💊', poop: '💩', food: '🍎', teething: '🦷' };
    showToast(`${icons[log.type] || '📝'} Logged!`);
    setModal(null);
  };
  const updateData = (key, value) => setData(d => ({ ...d, [key]: value }));

  // Not yet checked auth — show a simple splash while Firebase resolves
  if (currentUser === undefined) {
    const st = getSplashTheme();
    return (
      <div style={{ background: st.bg, minHeight: "100vh", width: "100vw", position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <img src={`${import.meta.env.BASE_URL}icon-1024.png`} alt="" style={{ width: 120, height: 120, borderRadius: 28, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 26, fontWeight: 700 }}>
          <span style={{ color: st.accent }}>Wieser</span>
          <span style={{ color: st.text }}> Baby</span>
        </div>
      </div>
    );
  }

  // Signed out — show auth screen
  if (!currentUser) {
    const authTheme = THEMES[sysDark ? "midnight" : "blossom"];
    return (
      <AuthScreen
        theme={authTheme}
        onSignedIn={(user) => {
          setCurrentUser(user);
          setData(null);
          setLoading(true);
          getUid().then(uid => {
            loadUserData(uid).then(raw => {
              const d = migrateData(raw) || JSON.parse(JSON.stringify(DEFAULT_DATA));
              setData(d);
              setLoading(false);
            });
          });
        }}
      />
    );
  }

  if (loading || !data) {
    const st = getSplashTheme();
    return (
      <div style={{ background: st.bg, minHeight: "100vh", width: "100vw", position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <img src={`${import.meta.env.BASE_URL}icon-1024.png`} alt="" style={{ width: 120, height: 120, borderRadius: 28, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 26, fontWeight: 700 }}>
          <span style={{ color: st.accent }}>Wieser</span>
          <span style={{ color: st.text }}> Baby</span>
        </div>
        <div style={{ color: st.textMuted, fontFamily: "'Nunito', sans-serif", fontSize: 13, marginTop: 4 }}>Loading…</div>
      </div>
    );
  }

  const todayStr = localDateStr(now);
  const todayLogs = data.logs.filter(l => l.date === todayStr);
  const setThemePref = (t) => { setUserTheme(currentUser?.uid || null, t); setUserThemeKey(t); };
  const commonProps = { data, theme, updateData, showToast, addLog, todayStr, now, setModal, navigate, navigateBack, todayLogs, activeBaby, activeBabyId, switchBaby, addBaby, reminders, setReminders, notifPermission, setNotifPermission, currentUser, setCurrentUser, handleHouseholdChange, userThemeKey, setThemePref };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overscroll-behavior: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes toastIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        input, select, textarea { font-family: 'Nunito', sans-serif; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${theme.accent}; outline-offset: -2px; }
        ::-webkit-scrollbar { width: 0; }
        .log-btn { transition: transform 0.12s ease; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
        .log-btn:active { transform: scale(0.94) !important; }
        .card { transition: background 0.15s ease; }
        .card:hover { background: ${theme.cardHover} !important; }
        .nav-btn { transition: all 0.15s ease; }
        .nav-btn:active { transform: scale(0.9); }
        .tab-btn { transition: all 0.15s ease; cursor: pointer; }
        .tab-btn:active { transform: scale(0.95); }
      `}</style>
      <div style={{ position: "fixed", inset: 0, background: theme.bg, zIndex: -1 }} />
      <div style={{ fontFamily: "'Nunito', sans-serif", background: theme.bg, color: theme.text, minHeight: "100vh", maxWidth: 520, margin: "0 auto", position: "relative", paddingBottom: 90 }}>
        {/* Header */}
        <header style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, background: `linear-gradient(${theme.bg}, ${theme.bg}ee)`, backdropFilter: "blur(12px)" }}>
          <div>
            <h1 onClick={() => { setPageHistory([]); setPage("dashboard"); }} style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: -0.5, cursor: "pointer" }}>
              <span style={{ color: theme.accent }}>{getLastName(currentUser)}</span> Baby
            </h1>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                {activeBaby.name !== "Baby" ? activeBaby.name : ""}{activeBaby.birthDate ? ` · ${ageString(activeBaby.birthDate)}` : ""}
                {(data.babies || []).length > 1 && (
                  <span onClick={() => setModal(<BabySwitcherModal babies={data.babies} activeBabyId={activeBabyId} switchBaby={(id) => { switchBaby(id); setModal(null); }} addBaby={addBaby} theme={theme} />)}
                    style={{ cursor: "pointer", background: theme.accentSoft, color: theme.accent, borderRadius: 8, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
                    switch
                  </span>
                )}
              </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {data.sleepState && <div style={{ background: theme.accentSoft, color: theme.accent, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, animation: "pulse 2s ease-in-out infinite" }}>😴 Sleeping</div>}
            {/* Profile avatar — taps to Settings */}
            <button
              onClick={() => { setPageHistory([]); setPage("settings"); }}
              style={{ width: 38, height: 38, borderRadius: "50%", border: `2px solid ${theme.border}`, background: theme.card, cursor: "pointer", padding: 0, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}
              title="Settings"
            >
              {currentUser?.photoURL
                ? <img src={currentUser.photoURL} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                : <span style={{ fontSize: 18 }}>👤</span>
              }
            </button>
          </div>
        </header>

        <main style={{ padding: "0 16px 16px", animation: "fadeIn 0.25s ease" }}>
          {page === "dashboard" && <DashboardPage {...commonProps} />}
          {page === "trends" && <TrendsPage {...commonProps} />}
          {page === "food" && <FoodPage {...commonProps} />}
          {page === "milestones" && <MilestonesPage {...commonProps} />}
          {page === "copilot" && <CoPilotPage {...commonProps} />}
          {page === "settings" && <SettingsPage {...commonProps} setModal={setModal} />}
          {page === "growth" && <GrowthPage {...commonProps} />}
          {page === "history" && <HistoryPage {...commonProps} />}
          {page === "activities" && <ActivitiesPage {...commonProps} />}
          {page === "family" && <FamilyPage {...commonProps} />}
          {page === "pooplog" && <PoopLogPage {...commonProps} />}
        </main>

        {/* Bottom Nav */}
        <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 520, background: `${theme.card}f5`, backdropFilter: "blur(16px)", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-around", padding: `8px 4px calc(8px + env(safe-area-inset-bottom, 0px))`, zIndex: 100 }}>
          {NAV_ITEMS.map(n => (
            <button key={n.id} className="nav-btn" onClick={() => { setPageHistory([]); setPage(n.id); }} style={{ background: page === n.id ? theme.accentSoft : "transparent", border: "none", borderRadius: 14, padding: "6px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 52 }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: page === n.id ? theme.accent : theme.textMuted }}>{n.label}</span>
            </button>
          ))}
        </nav>

        {modal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
            <div style={{ background: theme.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 520, maxHeight: "88vh", overflow: "auto", animation: "slideUp 0.25s ease", padding: "24px 20px calc(20px + env(safe-area-inset-bottom, 0px))" }}>{modal}</div>
          </div>
        )}

        {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.type === "success" ? theme.success : toast.type === "error" ? "#e57373" : theme.warning, color: "#000", padding: "10px 24px", borderRadius: 30, fontWeight: 700, fontSize: 14, zIndex: 300, animation: "toastIn 0.2s ease", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>{toast.msg}</div>}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════
function QuickLogButton({ icon, label, sublabel, color, theme, onClick, active }) {
  return (<button className="log-btn" onClick={onClick} style={{ background: active ? `${color}30` : theme.card, border: `2px solid ${active ? color : theme.border}`, borderRadius: 22, padding: "20px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", minHeight: 110, justifyContent: "center", boxShadow: active ? `0 0 20px ${color}30` : "none" }}><span style={{ fontSize: 36 }}>{icon}</span><span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{label}</span>{sublabel && <span style={{ fontSize: 12, color, fontWeight: 700 }}>{sublabel}</span>}</button>);
}
function SummaryBubble({ icon, value, unit, sub, color, theme }) {
  return (<div style={{ textAlign: "center" }}><span style={{ fontSize: 14 }}>{icon}</span><div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'Fredoka', sans-serif", lineHeight: 1.1 }}>{value}</div><div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" }}>{unit}</div><div style={{ fontSize: 9, color: theme.textMuted, marginTop: 2 }}>{sub}</div></div>);
}
function QuickAction({ icon, label, theme, onClick }) {
  return (<button className="log-btn" onClick={onClick} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}><span style={{ fontSize: 20 }}>{icon}</span><span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted }}>{label}</span></button>);
}
function SectionLabel({ children, theme }) {
  return <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{children}</h3>;
}
function MacroBox({ label, value, unit, color, theme }) {
  return (<div style={{ background: theme.bg, borderRadius: 10, padding: "6px 8px" }}><div style={{ fontSize: 16, fontWeight: 900, color, fontFamily: "'Fredoka', sans-serif" }}>{value}<span style={{ fontSize: 10, fontWeight: 600 }}>{unit}</span></div><div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700, textTransform: "uppercase" }}>{label}</div></div>);
}
const inputStyle = (theme) => ({ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 12px", color: theme.text, fontSize: 14, width: "100%" });
const logIcon = (type) => ({ bottle: "🍼", poop: "💩", diaper: "💧", sleep: "😴", medicine: "💊", food: "🍎", teething: "🦷" }[type] || "📝");

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashboardPage({ data, todayLogs, todayStr, theme, setModal, addLog, updateData, now, navigate, showToast }) {
  const bottles = todayLogs.filter(l => l.type === "bottle");
  const poops = todayLogs.filter(l => l.type === "poop");
  const wets = todayLogs.filter(l => l.type === "diaper");
  const sleeps = todayLogs.filter(l => l.type === "sleep");
  const foods = todayLogs.filter(l => l.type === "food");
  const totalOz = bottles.reduce((s, b) => s + (b.amount || 0), 0);
  const totalCals = foods.reduce((s, f) => s + (f.calories || 0), 0);

  const lastBottle = bottles[bottles.length - 1];
  const timeSince = lastBottle ? (() => { const m = Math.floor((now - new Date(lastBottle.timestamp)) / 60000); return m < 60 ? `${m}m ago` : `${Math.floor(m/60)}h ${m%60}m`; })() : null;

  const handleSleepToggle = () => {
    if (data.sleepState) {
      // Waking up — show confirmation modal
      setModal(
        <SleepEndModal
          theme={theme}
          now={now}
          sleepState={data.sleepState}
          todayStr={todayStr}
          onEnd={(endTime, durationMins, date) => {
            addLog({ type: "sleep", subtype: "woke_up", date, time: localTimeStr(endTime), durationMins });
            updateData("sleepState", null);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      );
    } else {
      // Starting sleep — show "Start Now or Edit Start Time" prompt
      setModal(
        <SleepStartModal
          theme={theme}
          now={now}
          onStart={(startTime) => {
            updateData("sleepState", { startTime });
            showToast("😴 Sleep timer started");
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      );
    }
  };
  const sleepDur = data.sleepState ? (() => { const m = Math.floor((now - new Date(data.sleepState.startTime)) / 60000); return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; })() : null;
  const sleepPrediction = !data.sleepState ? predictNextSleep(data.logs || [], now) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <QuickLogButton icon="🍼" label="Bottle" sublabel={totalOz > 0 ? `${totalOz} oz today` : null} color={theme.info} theme={theme} onClick={() => setModal(<BottleModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
        <QuickLogButton icon="😴" label={data.sleepState ? "Wake Up" : "Sleep"} sublabel={sleepDur} color={theme.purple} theme={theme} onClick={handleSleepToggle} active={!!data.sleepState} />
        <QuickLogButton icon="💩" label="Poop" sublabel={poops.length > 0 ? `${poops.length} today` : null} color={theme.warning} theme={theme} onClick={() => setModal(<PoopModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
        <QuickLogButton icon="🍎" label="Food" sublabel={totalCals > 0 ? `${totalCals} cal` : null} color={theme.success} theme={theme} onClick={() => setModal(<FoodLogModal theme={theme} addLog={addLog} data={data} updateData={updateData} todayStr={todayStr} now={now} showToast={showToast} />)} />
      </div>

      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <SectionLabel theme={theme}>Today's Summary</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <SummaryBubble icon="🍼" value={`${totalOz}`} unit="oz" sub={timeSince || "none"} color={theme.info} theme={theme} />
          <SummaryBubble icon="💩" value={`${poops.length}`} unit="poop" sub={`${wets.length} wet`} color={theme.warning} theme={theme} />
          <SummaryBubble icon="😴" value={`${sleeps.length}`} unit="naps" sub={data.sleepState ? "zzz" : "awake"} color={theme.purple} theme={theme} />
          <SummaryBubble icon="🍎" value={`${totalCals}`} unit="cal" sub={`${foods.length} items`} color={theme.success} theme={theme} />
        </div>
      </div>

      {sleepPrediction && sleepPrediction.confidence !== 0 && (
        <div style={{ background: theme.card, borderRadius: 20, padding: 18, border: `1px solid ${theme.purple}40`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 36 }}>😴</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: theme.purple, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
              Sleep Prediction · {sleepPrediction.confidence} confidence
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{sleepPrediction.message}</div>
            {sleepPrediction.avgNapDuration > 0 && (
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>
                Avg nap: {sleepPrediction.avgNapDuration}m · Awake window: {sleepPrediction.avgAwakeMins}m
              </div>
            )}
          </div>
          {sleepPrediction.timeStr && (
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.purple, fontFamily: "'Fredoka'" }}>{sleepPrediction.timeStr}</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>predicted</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
        <QuickAction icon="💧" label="Wet" theme={theme} onClick={() => addLog({ type: "diaper", subtype: "wet", date: todayStr, time: localTimeStr(now) })} />
        <QuickAction icon="💊" label="Meds" theme={theme} onClick={() => setModal(<MedicineModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
        <QuickAction icon="📝" label="Note" theme={theme} onClick={() => setModal(<NoteModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
        <QuickAction icon="🦷" label="Teeth" theme={theme} onClick={() => setModal(<TeethingModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
        <QuickAction icon="📅" label="History" theme={theme} onClick={() => navigate("history")} />
        <QuickAction icon="📏" label="Growth" theme={theme} onClick={() => navigate("growth")} />
        <QuickAction icon="🩺" label="Doctor" theme={theme} onClick={() => setModal(<DoctorModal theme={theme} data={data} updateData={updateData} showToast={showToast} />)} />
        <QuickAction icon="💩" label="Poop Log" theme={theme} onClick={() => navigate("pooplog")} />
      </div>

      {/* Poop health alert */}
      {(() => {
        const lp = [...(data.logs || [])].reverse().find(l => l.type === "poop");
        if (!lp) return null;
        const ci = POOP_COLORS.find(c => c.id === lp.color);
        const co = POOP_CONSISTENCIES.find(c => c.id === lp.consistency);
        const isAlert = ci?.status === "alert" || co?.status === "alert";
        const isWatch = ci?.status === "watch" || co?.status === "watch";
        if (!isAlert && !isWatch) return null;
        return (
          <div style={{ background: isAlert ? "rgba(192,57,43,0.12)" : "rgba(246,174,45,0.12)", borderRadius: 16, padding: 16, border: `1px solid ${isAlert ? "rgba(192,57,43,0.3)" : "rgba(246,174,45,0.3)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{isAlert ? "⚠️" : "👀"}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: isAlert ? "#e57373" : theme.warning }}>{isAlert ? "Poop Alert" : "Worth Monitoring"}</span>
            </div>
            <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>Last: {ci?.label}, {co?.label}. {isAlert ? "Consider calling your pediatrician." : "Watch the next few diapers."}</p>
            <button onClick={() => navigate("pooplog")} style={{ marginTop: 8, background: "none", border: `1px solid ${theme.border}`, borderRadius: 10, padding: "6px 14px", color: theme.accent, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>View Patterns →</button>
          </div>
        );
      })()}

      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <SectionLabel theme={theme}>Recent Activity</SectionLabel>
        {todayLogs.length === 0 ? <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", padding: 20 }}>No logs yet today!</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...todayLogs].reverse().slice(0, 10).map(log => (
              <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 20 }}>{logIcon(log.type)}</span>
                <div style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 600 }}>
                  {log.type === "bottle" ? `${log.amount} oz ${log.feedType || ""}` :
                   log.type === "poop" ? `${POOP_COLORS.find(c=>c.id===log.color)?.label||""} / ${POOP_CONSISTENCIES.find(c=>c.id===log.consistency)?.label||""}` :
                   log.type === "diaper" ? "Wet diaper" :
                   log.type === "sleep" ? (log.subtype === "woke_up" ? (log.durationMins >= 60 ? `Slept ${Math.floor((log.durationMins||0)/60)}h ${(log.durationMins||0)%60}m` : `Slept ${log.durationMins||0}m`) : "Fell asleep") :
                   log.type === "food" ? `${log.foodName||"Food"} ${log.calories?`(${log.calories}cal)`:""}` :
                   log.type === "medicine" ? log.name :
                   log.type === "teething" ? `Tooth - ${log.tooth||""}` :
                   log.note?.slice(0, 30) || "Note"}
                </span></div>
                <span style={{ fontSize: 12, color: theme.textMuted }}>{formatTime12(log.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ENHANCED POOP MODAL (3-step wizard)
// ═══════════════════════════════════════════════════════════════
function PoopModal({ theme, addLog, todayStr, now }) {
  const [step, setStep] = useState(1);
  const [color, setColor] = useState("");
  const [consistency, setConsistency] = useState("");
  const [amount, setAmount] = useState("medium");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState(localTimeStr(now));

  const ci = POOP_COLORS.find(c => c.id === color);
  const co = POOP_CONSISTENCIES.find(c => c.id === consistency);

  const getVerdict = () => {
    if (!ci || !co) return null;
    if (ci.status === "alert" || co.status === "alert") return { icon: "🚨", label: "Talk to Pediatrician", color: "#e57373", bg: "rgba(229,115,115,0.12)", msg: [ci.status === "alert" ? ci.health : "", co.status === "alert" ? co.health : ""].filter(Boolean).join(" ") };
    if (ci.status === "watch" || co.status === "watch") return { icon: "👀", label: "Worth Monitoring", color: "#f6ae2d", bg: "rgba(246,174,45,0.12)", msg: [ci.status === "watch" ? ci.health : "", co.status === "watch" ? co.health : ""].filter(Boolean).join(" ") };
    return { icon: "✅", label: "Looks Healthy!", color: "#88d8b0", bg: "rgba(136,216,176,0.12)", msg: "This looks perfectly normal. Great job tracking!" };
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 4, textAlign: "center" }}>💩 Log Poop</h2>
      <p style={{ fontSize: 12, color: theme.textMuted, textAlign: "center", marginBottom: 16 }}>Step {step} of 3</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
        {[1,2,3].map(s => <div key={s} style={{ width: s === step ? 28 : 8, height: 8, borderRadius: 4, background: s <= step ? theme.accent : theme.border, transition: "all 0.2s ease" }} />)}
      </div>

      {step === 1 && (<div>
        <SectionLabel theme={theme}>What color?</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {POOP_COLORS.map(c => (
            <button key={c.id} className="log-btn" onClick={() => setColor(c.id)} style={{ background: color === c.id ? `${c.hex}20` : theme.bg, border: `2px solid ${color === c.id ? c.hex : theme.border}`, borderRadius: 14, padding: "12px 10px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: c.hex, flexShrink: 0, border: c.id === "white" ? `1px solid ${theme.border}` : "none" }} />
              <div><div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{c.label}</div><div style={{ fontSize: 10, color: c.status === "alert" ? "#e57373" : c.status === "watch" ? theme.warning : theme.success }}>{c.status === "alert" ? "⚠️ Alert" : c.status === "watch" ? "👀 Monitor" : "✅ Normal"}</div></div>
            </button>
          ))}
        </div>
        <button onClick={() => color && setStep(2)} disabled={!color} style={{ width: "100%", padding: 16, borderRadius: 16, background: color ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: color ? "pointer" : "default", marginTop: 16 }}>Next: Consistency →</button>
      </div>)}

      {step === 2 && (<div>
        <SectionLabel theme={theme}>What consistency?</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {POOP_CONSISTENCIES.map(c => (
            <button key={c.id} className="card" onClick={() => setConsistency(c.id)} style={{ background: consistency === c.id ? theme.accentSoft : theme.bg, border: `2px solid ${consistency === c.id ? theme.accent : theme.border}`, borderRadius: 14, padding: "14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 22 }}>{c.emoji}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{c.label}</div><div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.3 }}>{c.health.split('.')[0]}.</div></div>
              <span style={{ fontSize: 10, color: c.status === "alert" ? "#e57373" : c.status === "watch" ? theme.warning : theme.success, fontWeight: 700 }}>{c.status === "alert" ? "⚠️" : c.status === "watch" ? "👀" : "✅"}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => setStep(1)} style={{ flex: 1, padding: 14, borderRadius: 14, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>← Back</button>
          <button onClick={() => consistency && setStep(3)} disabled={!consistency} style={{ flex: 2, padding: 14, borderRadius: 14, background: consistency ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 14, border: "none", cursor: consistency ? "pointer" : "default" }}>Next →</button>
        </div>
      </div>)}

      {step === 3 && (<div>
        {(() => { const v = getVerdict(); if (!v) return null; return (
          <div style={{ background: v.bg, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${v.color}30` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 20 }}>{v.icon}</span><span style={{ fontSize: 16, fontWeight: 800, color: v.color }}>{v.label}</span></div>
            <p style={{ fontSize: 12, color: theme.text, lineHeight: 1.6 }}>{v.msg}</p>
          </div>
        ); })()}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, background: theme.bg, borderRadius: 12, padding: 12, textAlign: "center" }}><div style={{ width: 20, height: 20, borderRadius: 6, background: ci?.hex, margin: "0 auto 4px" }} /><div style={{ fontSize: 12, fontWeight: 700 }}>{ci?.label}</div></div>
          <div style={{ flex: 1, background: theme.bg, borderRadius: 12, padding: 12, textAlign: "center" }}><div style={{ fontSize: 18 }}>{co?.emoji}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{co?.label}</div></div>
        </div>
        <SectionLabel theme={theme}>Amount</SectionLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {POOP_AMOUNTS.map(a => (<button key={a.id} onClick={() => setAmount(a.id)} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, textAlign: "center", background: amount === a.id ? theme.accentSoft : theme.bg, border: `1px solid ${amount === a.id ? theme.accent : theme.border}`, cursor: "pointer", color: amount === a.id ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 11 }}>{a.emoji}<br/>{a.label}</button>))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} />
          <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle(theme), flex: 2 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setStep(2)} style={{ flex: 1, padding: 14, borderRadius: 14, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>← Back</button>
          <button onClick={() => addLog({ type: "poop", color, consistency, amount, notes, date: todayStr, time })} style={{ flex: 2, padding: 14, borderRadius: 14, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer" }}>💩 Log Poop</button>
        </div>
      </div>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// POOP PATTERNS PAGE
// ═══════════════════════════════════════════════════════════════
function PoopLogPage({ data, theme, navigateBack }) {
  const poops = (data.logs || []).filter(l => l.type === "poop").sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  const last14 = Array.from({length: 14}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return localDateStr(d); });
  const freqData = last14.map(d => ({ day: d.slice(5), count: poops.filter(l => l.date === d).length }));

  const colorCounts = {}, consistCounts = {};
  poops.slice(0, 60).forEach(p => { colorCounts[p.color] = (colorCounts[p.color] || 0) + 1; consistCounts[p.consistency] = (consistCounts[p.consistency] || 0) + 1; });
  const topColor = Object.entries(colorCounts).sort((a,b) => b[1]-a[1])[0];
  const topConsist = Object.entries(consistCounts).sort((a,b) => b[1]-a[1])[0];
  const avgPerDay = poops.length > 0 ? (poops.filter(p => last14.includes(p.date)).length / 14).toFixed(1) : "0";
  const alertCount = poops.slice(0,30).filter(p => POOP_COLORS.find(c=>c.id===p.color)?.status === "alert" || POOP_CONSISTENCIES.find(c=>c.id===p.consistency)?.status === "alert").length;
  const colorChartData = Object.entries(colorCounts).map(([id, count]) => ({ name: POOP_COLORS.find(c=>c.id===id)?.label || id, value: count, fill: POOP_COLORS.find(c=>c.id===id)?.hex || "#888" }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}><button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>💩 Poop Patterns</h2></div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: theme.card, borderRadius: 16, padding: 14, border: `1px solid ${theme.border}`, textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 900, color: theme.accent, fontFamily: "'Fredoka', sans-serif" }}>{avgPerDay}</div><div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700 }}>PER DAY</div></div>
        <div style={{ background: theme.card, borderRadius: 16, padding: 14, border: `1px solid ${theme.border}`, textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 900, color: theme.success, fontFamily: "'Fredoka', sans-serif" }}>{topConsist ? POOP_CONSISTENCIES.find(c=>c.id===topConsist[0])?.emoji : "—"}</div><div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700 }}>TYPICAL</div></div>
        <div style={{ background: theme.card, borderRadius: 16, padding: 14, border: `1px solid ${theme.border}`, textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 900, color: alertCount > 0 ? "#e57373" : theme.success, fontFamily: "'Fredoka', sans-serif" }}>{alertCount}</div><div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700 }}>ALERTS</div></div>
      </div>

      <div style={{ background: theme.card, borderRadius: 20, padding: "16px 8px 8px 0", border: `1px solid ${theme.border}`, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingLeft: 16, marginBottom: 8 }}>14-Day Frequency</h3>
        <ResponsiveContainer width="100%" height={120}><BarChart data={freqData}><CartesianGrid strokeDasharray="3 3" stroke={theme.border} /><XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 9 }} axisLine={false} interval={1} /><YAxis tick={{ fill: theme.textMuted, fontSize: 10 }} axisLine={false} width={20} allowDecimals={false} /><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.text }} /><Bar dataKey="count" fill={theme.warning} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </div>

      {colorChartData.length > 0 && (
        <div style={{ background: theme.card, borderRadius: 20, padding: 16, border: `1px solid ${theme.border}`, marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Color Distribution</h3>
          <ResponsiveContainer width="100%" height={120}><PieChart><Pie data={colorChartData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25} paddingAngle={2}>{colorChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12, color: theme.text }} /></PieChart></ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>{colorChartData.map(c => (<div key={c.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: theme.textMuted }}><div style={{ width: 10, height: 10, borderRadius: 3, background: c.fill }} />{c.name} ({c.value})</div>))}</div>
        </div>
      )}

      <div style={{ background: theme.card, borderRadius: 20, padding: 16, border: `1px solid ${theme.border}`, marginBottom: 16 }}>
        <SectionLabel theme={theme}>Pattern Insights</SectionLabel>
        {poops.length < 3 ? <p style={{ fontSize: 13, color: theme.textMuted }}>Log 3+ poops to see insights.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, lineHeight: 1.6 }}>
            <div><b>Frequency:</b> <span style={{ color: theme.textMuted }}>{avgPerDay}/day. {parseFloat(avgPerDay) < 1 ? "Low - watch for constipation." : parseFloat(avgPerDay) > 4 ? "High - normal for young babies." : "Normal range."}</span></div>
            {topColor && <div><b>Top color:</b> <span style={{ color: theme.textMuted }}>{POOP_COLORS.find(c=>c.id===topColor[0])?.label} ({topColor[1]}x). {POOP_COLORS.find(c=>c.id===topColor[0])?.health}</span></div>}
            {topConsist && <div><b>Top texture:</b> <span style={{ color: theme.textMuted }}>{POOP_CONSISTENCIES.find(c=>c.id===topConsist[0])?.label} ({topConsist[1]}x). {POOP_CONSISTENCIES.find(c=>c.id===topConsist[0])?.health}</span></div>}
          </div>
        )}
      </div>

      <SectionLabel theme={theme}>Recent Logs</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {poops.slice(0, 15).map(log => { const ci = POOP_COLORS.find(c => c.id === log.color); const co = POOP_CONSISTENCIES.find(c => c.id === log.consistency); const bad = ci?.status === "alert" || co?.status === "alert"; const watch = ci?.status === "watch" || co?.status === "watch"; return (
          <div key={log.id} className="card" style={{ background: theme.card, borderRadius: 14, padding: "12px 14px", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: ci?.hex || "#888", flexShrink: 0 }} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{ci?.label} / {co?.label}</div><div style={{ fontSize: 11, color: theme.textMuted }}>{log.date} {formatTime12(log.time)} {log.amount && log.amount !== "medium" ? `\u00B7 ${log.amount}` : ""}</div></div>
            <span style={{ fontSize: 12, color: bad ? "#e57373" : watch ? theme.warning : theme.success }}>{bad ? "⚠️" : watch ? "👀" : "✅"}</span>
          </div>
        ); })}
        {poops.length === 0 && <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", padding: 20 }}>No poop logs yet.</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FOOD PAGE + BARCODE SCANNER
// ═══════════════════════════════════════════════════════════════
function FoodPage({ data, theme, updateData, addLog, setModal, showToast, todayStr, now }) {
  const [tab, setTab] = useState("log");
  const foodLogs = (data.logs || []).filter(l => l.type === "food");
  const todayFoods = foodLogs.filter(l => l.date === todayStr);
  const prefs = data.foodPreferences || { likes: [], dislikes: [] };
  const days = last7Days();
  const tm = { cal: todayFoods.reduce((s,f)=>s+(f.calories||0),0), protein: todayFoods.reduce((s,f)=>s+(f.protein||0),0), carbs: todayFoods.reduce((s,f)=>s+(f.carbs||0),0), fat: todayFoods.reduce((s,f)=>s+(f.fat||0),0), fiber: todayFoods.reduce((s,f)=>s+(f.fiber||0),0), sugar: todayFoods.reduce((s,f)=>s+(f.sugar||0),0) };
  const weeklyData = days.map(d => { const dl = foodLogs.filter(l => l.date === d); return { day: dayLabel(d), cal: dl.reduce((s,f)=>s+(f.calories||0),0), protein: dl.reduce((s,f)=>s+(f.protein||0),0) }; });
  const macroChart = [{ name: "Protein", value: tm.protein, color: theme.info },{ name: "Carbs", value: tm.carbs, color: theme.warning },{ name: "Fat", value: tm.fat, color: theme.accent }].filter(d => d.value > 0);

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>🍎 Food Tracker</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {[{id:"log",label:"Today"},{id:"weekly",label:"Weekly"},{id:"likes",label:"Likes & Dislikes"},{id:"all",label:"All Foods"}].map(t => (<button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{ background: tab === t.id ? theme.accentSoft : theme.card, border: `1px solid ${tab === t.id ? theme.accent : theme.border}`, borderRadius: 12, padding: "8px 14px", color: tab === t.id ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>{t.label}</button>))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="log-btn" onClick={() => setModal(<FoodLogModal theme={theme} addLog={addLog} data={data} updateData={updateData} todayStr={todayStr} now={now} showToast={showToast} />)} style={{ flex: 1, padding: 14, borderRadius: 16, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer" }}>+ Log Food</button>
        <button className="log-btn" onClick={() => setModal(<BarcodeScanModal theme={theme} addLog={addLog} data={data} updateData={updateData} todayStr={todayStr} now={now} showToast={showToast} />)} style={{ flex: 1, padding: 14, borderRadius: 16, background: theme.card, color: theme.accent, fontWeight: 800, fontSize: 14, border: `2px solid ${theme.accent}`, cursor: "pointer" }}>📷 Scan Barcode</button>
      </div>

      {tab === "log" && (<>
        <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, marginBottom: 16 }}>
          <SectionLabel theme={theme}>Today's Nutrition</SectionLabel>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {macroChart.length > 0 ? (<div style={{ width: 90, height: 90, flexShrink: 0 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={macroChart} dataKey="value" cx="50%" cy="50%" outerRadius={40} innerRadius={22}>{macroChart.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie></PieChart></ResponsiveContainer></div>) : (<div style={{ width: 90, height: 90, borderRadius: "50%", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: theme.textMuted, textAlign: "center", flexShrink: 0 }}>No food<br/>yet</div>)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
              <MacroBox label="Calories" value={tm.cal} unit="kcal" color={theme.accent} theme={theme} />
              <MacroBox label="Protein" value={tm.protein} unit="g" color={theme.info} theme={theme} />
              <MacroBox label="Carbs" value={tm.carbs} unit="g" color={theme.warning} theme={theme} />
              <MacroBox label="Fat" value={tm.fat} unit="g" color={theme.accent} theme={theme} />
              <MacroBox label="Fiber" value={tm.fiber} unit="g" color={theme.success} theme={theme} />
              <MacroBox label="Sugar" value={tm.sugar} unit="g" color={theme.purple} theme={theme} />
            </div>
          </div>
        </div>
        <SectionLabel theme={theme}>Today's Food</SectionLabel>
        {todayFoods.length === 0 ? <p style={{ color: theme.textMuted, fontSize: 13, textAlign: "center", padding: 20 }}>No food logged today.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...todayFoods].reverse().map(f => (
              <div key={f.id} style={{ background: theme.card, borderRadius: 14, padding: "12px 14px", border: `1px solid ${f.source === "bottle" ? theme.info + "60" : theme.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.source === "bottle" ? "🍼 " : ""}{f.foodName}{f.reaction === "loved" ? " 😍" : f.reaction === "refused" ? " 🙅" : ""}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{f.servingSize || ""}{f.time ? ` · ${formatTime12(f.time)}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: theme.accent }}>{f.calories||0} cal</div>
                  <div style={{ fontSize: 10, color: theme.textMuted }}>P:{f.protein||0} C:{f.carbs||0} F:{f.fat||0}</div>
                </div>
                <button
                  onClick={() => setModal(<EditLogModal theme={theme} log={f} onSave={(updated) => { updateData("logs", data.logs.map(x => x.id === f.id ? { ...x, ...updated } : x)); showToast("✏️ Updated!"); setModal(null); }} onClose={() => setModal(null)} now={now} />)}
                  style={{ background: theme.accentSoft, border: `1px solid ${theme.accent}40`, borderRadius: 8, padding: "5px 10px", color: theme.accent, fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                  ✏️
                </button>
                <button
                  onClick={() => { if (window.confirm("Delete this food log?")) { updateData("logs", data.logs.filter(x => x.id !== f.id)); showToast("Deleted"); } }}
                  style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: theme.textMuted, flexShrink: 0, lineHeight: 1 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </>)}

      {tab === "weekly" && (<>
        <div style={{ background: theme.card, borderRadius: 20, padding: "16px 8px 8px 0", border: `1px solid ${theme.border}`, marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingLeft: 16, marginBottom: 8 }}>Calories</h3>
          <ResponsiveContainer width="100%" height={160}><BarChart data={weeklyData}><CartesianGrid strokeDasharray="3 3" stroke={theme.border} /><XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={35} /><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.text }} /><Bar dataKey="cal" fill={theme.accent} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
        <div style={{ background: theme.card, borderRadius: 20, padding: "16px 8px 8px 0", border: `1px solid ${theme.border}` }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingLeft: 16, marginBottom: 8 }}>Protein (g)</h3>
          <ResponsiveContainer width="100%" height={140}><AreaChart data={weeklyData}><CartesianGrid strokeDasharray="3 3" stroke={theme.border} /><XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={30} /><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.text }} /><Area type="monotone" dataKey="protein" stroke={theme.info} fill={`${theme.info}30`} strokeWidth={2} /></AreaChart></ResponsiveContainer>
        </div>
      </>)}

      {tab === "likes" && <FoodPrefsTab prefs={prefs} data={data} updateData={updateData} theme={theme} showToast={showToast} />}

      {tab === "all" && (<div>
        <SectionLabel theme={theme}>All Foods Tried</SectionLabel>
        {(() => { const seen = new Map(); foodLogs.forEach(f => { if (!f.foodName) return; const k = f.foodName.toLowerCase(); if (!seen.has(k)) seen.set(k, { name: f.foodName, count: 1, lastDate: f.date }); else { const e = seen.get(k); e.count++; if (f.date > e.lastDate) e.lastDate = f.date; } }); const items = [...seen.values()].sort((a,b) => b.count - a.count); if (!items.length) return <p style={{ color: theme.textMuted, fontSize: 13, textAlign: "center", padding: 20 }}>No foods logged yet.</p>;
          return items.map(f => (<div key={f.name} className="card" style={{ background: theme.card, borderRadius: 12, padding: "10px 14px", border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><div><span style={{ fontSize: 13, fontWeight: 700 }}>{f.name}</span>{prefs.likes.includes(f.name.toLowerCase()) && <span style={{ marginLeft: 6 }}>💚</span>}{prefs.dislikes.includes(f.name.toLowerCase()) && <span style={{ marginLeft: 6 }}>👎</span>}</div><span style={{ fontSize: 12, color: theme.textMuted }}>{f.count}x</span></div>));
        })()}
      </div>)}
    </div>
  );
}

function FoodPrefsTab({ prefs, data, updateData, theme, showToast }) {
  const [nl, setNl] = useState(""); const [nd, setNd] = useState("");
  const addPref = (type, val) => { if (!val.trim()) return; const k = val.trim().toLowerCase(); const u = { ...prefs }; if (type === "like" && !u.likes.includes(k)) { u.likes = [...u.likes, k]; u.dislikes = u.dislikes.filter(d => d !== k); } if (type === "dislike" && !u.dislikes.includes(k)) { u.dislikes = [...u.dislikes, k]; u.likes = u.likes.filter(l => l !== k); } updateData("foodPreferences", u); type === "like" ? setNl("") : setNd(""); showToast(type === "like" ? "💚 Added!" : "👎 Added"); };
  const rmPref = (type, val) => { const u = { ...prefs }; if (type === "like") u.likes = u.likes.filter(l => l !== val); else u.dislikes = u.dislikes.filter(d => d !== val); updateData("foodPreferences", u); };
  return (
    <div>
      <div style={{ background: theme.card, borderRadius: 20, padding: 16, border: `1px solid ${theme.border}`, marginBottom: 16 }}>
        <SectionLabel theme={theme}>💚 Likes</SectionLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input placeholder="Add food..." value={nl} onChange={e => setNl(e.target.value)} onKeyDown={e => e.key === "Enter" && addPref("like", nl)} style={inputStyle(theme)} /><button onClick={() => addPref("like", nl)} style={{ padding: "10px 16px", borderRadius: 12, background: theme.success, color: "#000", fontWeight: 800, border: "none", cursor: "pointer" }}>+</button></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{prefs.likes.map(l => (<span key={l} style={{ background: "rgba(136,216,176,0.15)", border: "1px solid rgba(136,216,176,0.3)", borderRadius: 10, padding: "6px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, textTransform: "capitalize" }}>{l} <button onClick={() => rmPref("like", l)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: 12, padding: 0 }}>x</button></span>))}{prefs.likes.length === 0 && <p style={{ fontSize: 12, color: theme.textMuted }}>No favorites yet.</p>}</div>
      </div>
      <div style={{ background: theme.card, borderRadius: 20, padding: 16, border: `1px solid ${theme.border}` }}>
        <SectionLabel theme={theme}>👎 Dislikes</SectionLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input placeholder="Add food..." value={nd} onChange={e => setNd(e.target.value)} onKeyDown={e => e.key === "Enter" && addPref("dislike", nd)} style={inputStyle(theme)} /><button onClick={() => addPref("dislike", nd)} style={{ padding: "10px 16px", borderRadius: 12, background: "#e57373", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" }}>+</button></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{prefs.dislikes.map(d => (<span key={d} style={{ background: "rgba(229,115,115,0.12)", border: "1px solid rgba(229,115,115,0.3)", borderRadius: 10, padding: "6px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, textTransform: "capitalize" }}>{d} <button onClick={() => rmPref("dislike", d)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: 12, padding: 0 }}>x</button></span>))}{prefs.dislikes.length === 0 && <p style={{ fontSize: 12, color: theme.textMuted }}>No dislikes yet.</p>}</div>
      </div>
    </div>
  );
}

// ─── FOOD LOG MODAL ───────────────────────────────────────────
const DEFAULT_QUICK_FOODS = [
  // Solids
  {n:"Banana",c:89,p:1,ca:23,f:0,fi:3,s:12,sv:"1 medium"},
  {n:"Avocado",c:80,p:1,ca:4,f:7,fi:3,s:0,sv:"1/4"},
  {n:"Sweet Potato",c:86,p:2,ca:20,f:0,fi:3,s:4,sv:"1/2 cup"},
  {n:"Yogurt",c:60,p:3,ca:7,f:2,fi:0,s:5,sv:"1/4 cup"},
  {n:"Cheerios",c:70,p:2,ca:14,f:1,fi:2,s:1,sv:"1/2 cup"},
  {n:"Apple Sauce",c:50,p:0,ca:14,f:0,fi:1,s:11,sv:"1/4 cup"},
  {n:"Egg",c:70,p:6,ca:0,f:5,fi:0,s:0,sv:"1 egg"},
  {n:"PB",c:95,p:4,ca:3,f:8,fi:1,s:2,sv:"1 tbsp"},
  {n:"Rice Cereal",c:60,p:1,ca:13,f:0,fi:0,s:1,sv:"1/4 cup"},
  {n:"Puffs",c:25,p:0,ca:5,f:0,fi:0,s:0,sv:"7 pcs"},
  // Liquids — bottles are auto-logged via the Bottle button
  // These are for non-bottle drinks (sippy cup, straw cup, etc.)
  {n:"Apple Juice",c:14,p:0,ca:4,f:0,fi:0,s:3,sv:"1 oz"},
  {n:"Orange Juice",c:14,p:0,ca:3,f:0,fi:0,s:3,sv:"1 oz"},
  {n:"Water",c:0,p:0,ca:0,f:0,fi:0,s:0,sv:"1 oz"},
];

function FoodLogModal({ theme, addLog, data, updateData, todayStr, now, showToast }) {
  const [fn, setFn] = useState(""); const [ss, setSs] = useState(""); const [cal, setCal] = useState(""); const [pro, setPro] = useState(""); const [carb, setCarb] = useState(""); const [fat, setFat] = useState(""); const [fib, setFib] = useState(""); const [sug, setSug] = useState(""); const [time, setTime] = useState(localTimeStr(now)); const [rx, setRx] = useState("");
  const [editingQuicks, setEditingQuicks] = useState(false);
  const [newQuick, setNewQuick] = useState({n:"",c:"",p:"",ca:"",f:"",fi:"",s:"",sv:""});
  // Store base nutrition per 1 unit of the picked item's default serving
  const [baseNutr, setBaseNutr] = useState(null);

  const qf = data.settings?.foodQuickPicks || DEFAULT_QUICK_FOODS;
  const saveQuicks = (updated) => updateData("settings", { ...(data.settings||{}), foodQuickPicks: updated });

  const pick = (f) => {
    setFn(f.n); setSs(f.sv||"");
    const baseQty = parseServingNum(f.sv) || 1;
    const base = {
      c: (f.c||0) / baseQty, p: (f.p||0) / baseQty, ca: (f.ca||0) / baseQty,
      fat: (f.f||0) / baseQty, fi: (f.fi||0) / baseQty, s: (f.s||0) / baseQty,
    };
    setBaseNutr(base);
    setCal(String(f.c||"")); setPro(String(f.p||"")); setCarb(String(f.ca||""));
    setFat(String(f.f||"")); setFib(String(f.fi||"")); setSug(String(f.s||""));
  };

  // Called whenever serving size input changes
  const handleServingChange = (newSs) => {
    setSs(newSs);
    if (!baseNutr) return;
    const qty = parseServingNum(newSs);
    if (!qty || qty <= 0) return;
    const r1 = (n) => String(Math.round(n * qty * 10) / 10);
    setCal(String(Math.round(baseNutr.c * qty)));
    setPro(r1(baseNutr.p)); setCarb(r1(baseNutr.ca));
    setFat(r1(baseNutr.fat)); setFib(r1(baseNutr.fi)); setSug(r1(baseNutr.s));
  };
  const submit = () => { if (!fn) return; addLog({ type: "food", foodName: fn, servingSize: ss, calories: parseFloat(cal)||0, protein: parseFloat(pro)||0, carbs: parseFloat(carb)||0, fat: parseFloat(fat)||0, fiber: parseFloat(fib)||0, sugar: parseFloat(sug)||0, date: todayStr, time, reaction: rx }); const prefs = data.foodPreferences || { likes: [], dislikes: [] }; const k = fn.toLowerCase(); if (rx === "loved" && !prefs.likes.includes(k)) updateData("foodPreferences", { ...prefs, likes: [...prefs.likes, k], dislikes: prefs.dislikes.filter(d => d !== k) }); if (rx === "refused" && !prefs.dislikes.includes(k)) updateData("foodPreferences", { ...prefs, dislikes: [...prefs.dislikes, k], likes: prefs.likes.filter(l => l !== k) }); };
  const addQuickPick = () => {
    if (!newQuick.n.trim()) return;
    saveQuicks([...qf, { ...newQuick, c: parseFloat(newQuick.c)||0, p: parseFloat(newQuick.p)||0, ca: parseFloat(newQuick.ca)||0, f: parseFloat(newQuick.f)||0, fi: parseFloat(newQuick.fi)||0, s: parseFloat(newQuick.s)||0 }]);
    setNewQuick({n:"",c:"",p:"",ca:"",f:"",fi:"",s:"",sv:""});
    showToast("✅ Quick pick added!");
  };
  const removeQuickPick = (idx) => saveQuicks(qf.filter((_, i) => i !== idx));
  const resetQuicks = () => { saveQuicks(DEFAULT_QUICK_FOODS); showToast("Reset to defaults"); };

  const is = inputStyle(theme);
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16, textAlign: "center" }}>🍎 Log Food</h2>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SectionLabel theme={theme}>Quick Picks</SectionLabel>
        <button onClick={() => setEditingQuicks(e => !e)} style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: 8, padding: "3px 10px", color: theme.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          {editingQuicks ? "Done" : "✏️ Edit"}
        </button>
      </div>
      {editingQuicks ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, maxHeight: 200, overflowY: "auto" }}>
            {qf.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: theme.bg, borderRadius: 10, padding: "8px 12px", border: `1px solid ${theme.border}` }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: theme.text }}>{f.n}</span>
                <span style={{ fontSize: 11, color: theme.textMuted }}>{f.c||0} cal · {f.sv||""}</span>
                <button onClick={() => removeQuickPick(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e57373", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ background: theme.bg, borderRadius: 12, padding: 12, border: `1px solid ${theme.border}`, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: theme.textMuted, marginBottom: 8 }}>ADD NEW QUICK PICK</p>
            <input placeholder="Name *" value={newQuick.n} onChange={e => setNewQuick(q => ({...q,n:e.target.value}))} style={{ ...is, marginBottom: 6 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
              {[["c","Cal"],["p","Protein g"],["ca","Carbs g"],["f","Fat g"],["fi","Fiber g"],["s","Sugar g"]].map(([k,lbl]) => (
                <input key={k} placeholder={lbl} type="number" value={newQuick[k]} onChange={e => setNewQuick(q => ({...q,[k]:e.target.value}))} style={is} />
              ))}
            </div>
            <input placeholder="Serving size (e.g. 1 cup)" value={newQuick.sv} onChange={e => setNewQuick(q => ({...q,sv:e.target.value}))} style={{ ...is, marginBottom: 8 }} />
            <button onClick={addQuickPick} disabled={!newQuick.n.trim()} style={{ width: "100%", padding: 10, borderRadius: 10, background: newQuick.n.trim() ? theme.accent : theme.border, color: "#fff", fontWeight: 700, border: "none", cursor: newQuick.n.trim() ? "pointer" : "default" }}>Add Quick Pick</button>
          </div>
          <button onClick={resetQuicks} style={{ width: "100%", padding: 8, borderRadius: 10, background: "none", border: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 12, cursor: "pointer" }}>Reset to defaults</button>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {/* Group by liquid vs solid based on sv containing "oz" */}
          {(() => {
            const solids = qf.filter(f => !(f.sv||"").includes("oz") || f.n === "Water");
            const liquids = qf.filter(f => (f.sv||"").includes("oz") && f.n !== "Water");
            const renderGroup = (items, label) => items.length === 0 ? null : (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {items.map((f, i) => (
                    <button key={i} onClick={() => pick(f)}
                      style={{ background: fn === f.n ? theme.accentSoft : theme.bg, border: `1px solid ${fn === f.n ? theme.accent : theme.border}`, borderRadius: 10, padding: "6px 12px", color: fn === f.n ? theme.accent : theme.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                      {f.n}
                    </button>
                  ))}
                </div>
              </div>
            );
            return (<>
              {renderGroup(solids, "🍽 Solids")}
              {renderGroup(liquids, "🥛 Liquids (per oz)")}
            </>);
          })()}
        </div>
      )}
      <input placeholder="Food name" value={fn} onChange={e => setFn(e.target.value)} style={{ ...is, fontSize: 16, fontWeight: 700, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><input placeholder="Serving (e.g. 2 cups)" value={ss} onChange={e => handleServingChange(e.target.value)} style={{ ...is, flex: 1 }} /><input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...is, flex: 1 }} /></div>
      <SectionLabel theme={theme}>Nutrition (optional)</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
        <input placeholder="Cal" type="number" value={cal} onChange={e => setCal(e.target.value)} style={is} />
        <input placeholder="Protein g" type="number" value={pro} onChange={e => setPro(e.target.value)} style={is} />
        <input placeholder="Carbs g" type="number" value={carb} onChange={e => setCarb(e.target.value)} style={is} />
        <input placeholder="Fat g" type="number" value={fat} onChange={e => setFat(e.target.value)} style={is} />
        <input placeholder="Fiber g" type="number" value={fib} onChange={e => setFib(e.target.value)} style={is} />
        <input placeholder="Sugar g" type="number" value={sug} onChange={e => setSug(e.target.value)} style={is} />
      </div>
      <SectionLabel theme={theme}>Reaction</SectionLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{[{id:"loved",e:"😍",l:"Loved"},{id:"liked",e:"😊",l:"Liked"},{id:"meh",e:"😐",l:"Meh"},{id:"refused",e:"🙅",l:"Refused"}].map(r => (<button key={r.id} onClick={() => setRx(r.id)} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, textAlign: "center", background: rx === r.id ? theme.accentSoft : theme.bg, border: `1px solid ${rx === r.id ? theme.accent : theme.border}`, cursor: "pointer", fontSize: 11, fontWeight: 700, color: rx === r.id ? theme.accent : theme.textMuted }}><span style={{ fontSize: 18, display: "block" }}>{r.e}</span>{r.l}</button>))}</div>
      <button onClick={submit} disabled={!fn} style={{ width: "100%", padding: 16, borderRadius: 16, background: fn ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: fn ? "pointer" : "default" }}>Log Food</button>
    </div>
  );
}

// ─── BARCODE SCAN MODAL ───────────────────────────────────────
function BarcodeScanModal({ theme, addLog, data, updateData, todayStr, now, showToast }) {
  const [mode, setMode]     = useState("choose"); // "choose" | "camera" | "manual" | "result"
  const [bc, setBc]         = useState("");
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");
  const [mult, setMult]     = useState(1);
  const [rx, setRx]         = useState(null);

  const fetchProduct = async (barcode) => {
    if (!barcode.trim()) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode.trim()}.json`);
      const json = await res.json();
      if (json.status === 1 && json.product) {
        const p = json.product; const n = p.nutriments || {};
        setProduct({ name: p.product_name || "Unknown product", brand: p.brands || "", servingSize: p.serving_size || "", nutriScore: p.nutriscore_grade || null, image: p.image_front_small_url || null, calories: n["energy-kcal_serving"] || n["energy-kcal_100g"] || 0, protein: n.proteins_serving || n.proteins_100g || 0, carbs: n.carbohydrates_serving || n.carbohydrates_100g || 0, fat: n.fat_serving || n.fat_100g || 0, fiber: n.fiber_serving || n.fiber_100g || 0, sugar: n.sugars_serving || n.sugars_100g || 0 });
        setMode("result");
      } else { setErr("Product not found. Try a different barcode or enter manually."); }
    } catch { setErr("Network error — check your connection."); }
    setLoading(false);
  };

  const handleCameraDetect = (code) => { setBc(code); setMode("loading"); fetchProduct(code); };

  const logFood = () => {
    if (!product) return;
    const m = mult; const time = now.toTimeString().slice(0,5);
    addLog({ type: "food", foodName: `${product.name}${product.brand ? ` (${product.brand})` : ""}`, servingSize: product.servingSize ? `${m}x ${product.servingSize}` : `${m} serving`, calories: Math.round(product.calories * m), protein: Math.round(product.protein * m * 10) / 10, carbs: Math.round(product.carbs * m * 10) / 10, fat: Math.round(product.fat * m * 10) / 10, fiber: Math.round(product.fiber * m * 10) / 10, sugar: Math.round(product.sugar * m * 10) / 10, date: todayStr, time, reaction: rx, barcode: bc.trim(), source: "barcode" });
    if (rx === "loved" || rx === "liked") updateData(d => { const f = d.foodPreferences || { likes: [], dislikes: [] }; if (!f.likes.includes(product.name)) f.likes = [product.name, ...f.likes.slice(0, 49)]; return { ...d, foodPreferences: f }; });
    if (rx === "refused") updateData(d => { const f = d.foodPreferences || { likes: [], dislikes: [] }; if (!f.dislikes.includes(product.name)) f.dislikes = [product.name, ...f.dislikes.slice(0, 49)]; return { ...d, foodPreferences: f }; });
    showToast("Food logged! 🍎");
  };

  // Show camera scanner in full-screen
  if (mode === "camera") return <BarcodeScanner theme={theme} onDetected={handleCameraDetect} onClose={() => setMode("choose")} />;

  return (
    <div>
      {mode === "choose" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
          <p style={{ fontSize: 14, color: theme.textMuted, textAlign: "center", marginBottom: 4 }}>How would you like to scan?</p>
          <button onClick={() => setMode("camera")} style={{ padding: "20px 16px", borderRadius: 16, background: theme.accentSoft, color: theme.accent, fontWeight: 700, fontSize: 16, border: `2px solid ${theme.accent}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            📷 Use Camera
          </button>
          <button onClick={() => setMode("manual")} style={{ padding: "20px 16px", borderRadius: 16, background: theme.card, color: theme.text, fontWeight: 600, fontSize: 16, border: `1px solid ${theme.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            ⌨️ Enter Barcode Manually
          </button>
        </div>
      )}

      {mode === "manual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, color: theme.textMuted, textAlign: "center" }}>Enter the barcode number from the package</p>
          <input value={bc} onChange={e => setBc(e.target.value)} placeholder="e.g. 0038000845260" style={{ padding: "14px 16px", borderRadius: 12, background: theme.card, border: `1px solid ${theme.border}`, color: theme.text, fontSize: 18, fontFamily: "monospace", letterSpacing: 2 }} />
          {err && <p style={{ color: theme.warning, fontSize: 13, textAlign: "center" }}>{err}</p>}
          <button onClick={() => fetchProduct(bc)} disabled={loading || !bc.trim()} style={{ padding: 16, borderRadius: 14, background: theme.accent, color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: loading || !bc.trim() ? 0.5 : 1 }}>
            {loading ? "Looking up…" : "Look Up Product"}
          </button>
        </div>
      )}

      {mode === "loading" && (
        <div style={{ textAlign: "center", padding: 40, color: theme.textMuted, fontFamily: "'Nunito'" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <p>Looking up barcode {bc}…</p>
          {err && <p style={{ color: theme.warning, fontSize: 13, marginTop: 12 }}>{err}<br /><button onClick={() => setMode("manual")} style={{ marginTop: 8, background: "none", border: "none", color: theme.accent, cursor: "pointer", textDecoration: "underline" }}>Enter manually instead</button></p>}
        </div>
      )}

      {mode === "result" && product && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            {product.image && <img src={product.image} alt="" style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 10, background: "#fff" }} />}
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: theme.text, margin: 0 }}>{product.name}</p>
              {product.brand && <p style={{ fontSize: 13, color: theme.textMuted, margin: "2px 0 0" }}>{product.brand}</p>}
              {product.nutriScore && <span style={{ fontSize: 11, fontWeight: 700, background: theme.accentSoft, color: theme.accent, padding: "2px 8px", borderRadius: 6 }}>Nutri-Score {product.nutriScore.toUpperCase()}</span>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[["Cal", product.calories, "kcal"], ["Protein", product.protein, "g"], ["Carbs", product.carbs, "g"], ["Fat", product.fat, "g"], ["Fiber", product.fiber, "g"], ["Sugar", product.sugar, "g"]].map(([l, v, u]) => (
              <div key={l} style={{ background: theme.card, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.accent }}>{Math.round(v * mult * 10) / 10}</div>
                <div style={{ fontSize: 10, color: theme.textMuted }}>{u}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: theme.textMuted }}>Servings:</span>
            {[0.5, 1, 1.5, 2, 3].map(n => (
              <button key={n} onClick={() => setMult(n)} style={{ padding: "6px 12px", borderRadius: 8, background: mult === n ? theme.accent : theme.card, color: mult === n ? "#fff" : theme.text, border: `1px solid ${theme.border}`, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{n}x</button>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 8 }}>Reaction?</p>
            <div style={{ display: "flex", gap: 8 }}>
              {[["loved","😍"],["liked","😊"],["meh","😐"],["refused","🙅"]].map(([v, emoji]) => (
                <button key={v} onClick={() => setRx(rx === v ? null : v)} style={{ flex: 1, padding: "10px 4px", borderRadius: 10, background: rx === v ? theme.accentSoft : theme.card, border: `1px solid ${rx === v ? theme.accent : theme.border}`, cursor: "pointer", fontSize: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  {emoji}<span style={{ fontSize: 9, color: theme.textMuted }}>{v}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={logFood} style={{ padding: 16, borderRadius: 14, background: theme.accent, color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}>Log This Food ✓</button>
          <button onClick={() => setMode("choose")} style={{ padding: 10, background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 13 }}>← Scan Another</button>
        </div>
      )}
    </div>
  );
}

// ─── SLEEP START MODAL ───────────────────────────────────────
function SleepStartModal({ theme, now, onStart, onClose }) {
  const [customTime, setCustomTime] = useState(localTimeStr(now));
  const [mode, setMode] = useState("choose"); // "choose" | "edit"

  if (mode === "choose") {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>😴</div>
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 8 }}>Starting Sleep</h2>
        <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 24, lineHeight: 1.5 }}>When did baby fall asleep?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={() => onStart(now.toISOString())}
            style={{ padding: "18px 16px", borderRadius: 16, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 17, border: "none", cursor: "pointer" }}>
            😴 Start Now ({localTimeStr(now)})
          </button>
          <button onClick={() => setMode("edit")}
            style={{ padding: "18px 16px", borderRadius: 16, background: theme.card, color: theme.text, fontWeight: 700, fontSize: 16, border: `1px solid ${theme.border}`, cursor: "pointer" }}>
            ✏️ Edit Start Time
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 14, cursor: "pointer", padding: 8 }}>Cancel</button>
        </div>
      </div>
    );
  }

  // Edit start time mode
  const handleCustomStart = () => {
    const [h, m] = customTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    // If the chosen time is in the future, assume it was yesterday
    if (d > new Date()) d.setDate(d.getDate() - 1);
    onStart(d.toISOString());
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 8, textAlign: "center" }}>✏️ Edit Start Time</h2>
      <p style={{ fontSize: 13, color: theme.textMuted, textAlign: "center", marginBottom: 20 }}>When did baby actually fall asleep?</p>
      <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
        style={{ ...inputStyle(theme), fontSize: 24, textAlign: "center", marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setMode("choose")} style={{ flex: 1, padding: 14, borderRadius: 14, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, cursor: "pointer" }}>← Back</button>
        <button onClick={handleCustomStart} style={{ flex: 2, padding: 14, borderRadius: 14, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer" }}>
          Start Sleep at {customTime}
        </button>
      </div>
    </div>
  );
}


// ─── SLEEP END MODAL ─────────────────────────────────────────
function SleepEndModal({ theme, now, sleepState, todayStr, onEnd, onClose }) {
  const [mode, setMode] = useState("choose"); // "choose" | "edit"
  const [customTime, setCustomTime] = useState(localTimeStr(now));

  const startTime = new Date(sleepState.startTime);
  const startedAt = formatTime12(localTimeStr(startTime));
  const currentMins = Math.floor((now - startTime) / 60000);
  const currentDurLabel = currentMins >= 60
    ? `${Math.floor(currentMins / 60)}h ${currentMins % 60}m`
    : `${currentMins}m`;

  const calcDuration = (endTime) => {
    const mins = Math.max(0, Math.floor((endTime - startTime) / 60000));
    return { mins, label: mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m` };
  };

  if (mode === "choose") {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>☀️</div>
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 4 }}>Wake Up</h2>
        <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4 }}>
          Started at {startedAt}
        </p>
        <p style={{ fontSize: 20, fontWeight: 900, color: theme.purple, fontFamily: "'Fredoka', sans-serif", marginBottom: 24 }}>
          {currentDurLabel} asleep
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={() => {
            const { mins } = calcDuration(now);
            onEnd(now, mins, todayStr);
          }} style={{ padding: "18px 16px", borderRadius: 16, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 17, border: "none", cursor: "pointer" }}>
            ☀️ End Now ({localTimeStr(now)})
          </button>
          <button onClick={() => setMode("edit")}
            style={{ padding: "18px 16px", borderRadius: 16, background: theme.card, color: theme.text, fontWeight: 700, fontSize: 16, border: `1px solid ${theme.border}`, cursor: "pointer" }}>
            ✏️ Edit End Time
          </button>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 14, cursor: "pointer", padding: 8 }}>
            Cancel (keep sleeping)
          </button>
        </div>
      </div>
    );
  }

  // Edit end time mode
  const handleCustomEnd = () => {
    const [h, m] = customTime.split(":").map(Number);
    const endDate = new Date();
    endDate.setHours(h, m, 0, 0);
    // If end time is before start, it must be on the same day — clamp to at least 1 min
    const { mins } = calcDuration(endDate);
    const date = localDateStr(endDate);
    onEnd(endDate, Math.max(1, mins), date);
  };

  const previewMins = (() => {
    const [h, m] = customTime.split(":").map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return calcDuration(d);
  })();

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 4, textAlign: "center" }}>✏️ Edit End Time</h2>
      <p style={{ fontSize: 13, color: theme.textMuted, textAlign: "center", marginBottom: 20 }}>
        When did baby actually wake up?
      </p>
      <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
        style={{ ...inputStyle(theme), fontSize: 24, textAlign: "center", marginBottom: 10 }} />
      {previewMins.mins > 0 && (
        <p style={{ fontSize: 14, color: theme.purple, fontWeight: 800, textAlign: "center", marginBottom: 20, fontFamily: "'Fredoka', sans-serif" }}>
          = {previewMins.label} sleep
        </p>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setMode("choose")}
          style={{ flex: 1, padding: 14, borderRadius: 14, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, cursor: "pointer" }}>
          ← Back
        </button>
        <button onClick={handleCustomEnd}
          style={{ flex: 2, padding: 14, borderRadius: 14, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer" }}>
          End Sleep at {customTime}
        </button>
      </div>
    </div>
  );
}

function BottleModal({ theme, addLog, todayStr, now }) {
  const [amt, setAmt] = useState(4); const [ft, setFt] = useState("formula"); const [time, setTime] = useState(localTimeStr(now));
  const step = 0.5;
  const dec = () => setAmt(a => Math.max(0.5, Math.round((a - step) * 10) / 10));
  const inc = () => setAmt(a => Math.round((a + step) * 10) / 10);
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>🍼 Log Bottle</h2>
      {/* Feed type */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "center", flexWrap: "wrap" }}>
        {["formula","breast","milk","water","juice"].map(t => (
          <button key={t} onClick={() => setFt(t)} style={{ background: ft === t ? theme.accentSoft : theme.bg, border: `1px solid ${ft === t ? theme.accent : theme.border}`, borderRadius: 12, padding: "8px 14px", color: ft === t ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>
      {/* Quick-pick amounts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        {[2,3,4,5,6,7,8].map(a => (
          <button key={a} onClick={() => setAmt(a)} style={{ width: 56, height: 56, borderRadius: 16, fontSize: 18, fontWeight: 800, background: amt === a ? theme.accent : theme.bg, color: amt === a ? "#fff" : theme.text, border: `2px solid ${amt === a ? theme.accent : theme.border}`, cursor: "pointer" }}>{a}</button>
        ))}
      </div>
      {/* Fine-tune stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, background: theme.bg, borderRadius: 18, border: `1px solid ${theme.border}`, overflow: "hidden", marginBottom: 16 }}>
        <button onClick={dec} style={{ width: 60, height: 60, fontSize: 28, fontWeight: 300, background: "none", border: "none", color: theme.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 32, fontWeight: 900, color: theme.text, fontFamily: "'Fredoka', sans-serif" }}>
          {amt} <span style={{ fontSize: 16, fontWeight: 600, color: theme.textMuted }}>oz</span>
        </div>
        <button onClick={inc} style={{ width: 60, height: 60, fontSize: 28, fontWeight: 300, background: "none", border: "none", color: theme.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
      </div>
      {/* Time */}
      <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 16 }} />
      <button onClick={() => {
        const nutr = bottleNutrition(ft, amt);
        const displayName = ft === "milk" ? "Whole Milk" : ft === "breast" ? "Breast Milk" : ft.charAt(0).toUpperCase() + ft.slice(1);
        addLog({ type: "bottle", amount: amt, feedType: ft, date: todayStr, time, ...nutr });
        addLog({ type: "food", foodName: `${displayName} (bottle)`, servingSize: `${amt} oz`, date: todayStr, time, source: "bottle", ...nutr });
      }} style={{ width: "100%", padding: 16, borderRadius: 16, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer" }}>
        Log {amt} oz {ft}
      </button>
    </div>
  );
}
function MedicineModal({ theme, addLog, todayStr, now }) {
  const [n, setN] = useState(""); const [d, setD] = useState(""); const [t, setT] = useState(localTimeStr(now));
  return (<div><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>💊 Medicine</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>{["Tylenol","Ibuprofen","Vitamin D","Multivitamin","Gripe Water","Gas Drops","Probiotics","Melatonin"].map(m => (<button key={m} onClick={() => setN(m)} style={{ background: n === m ? theme.accentSoft : theme.bg, border: `1px solid ${n === m ? theme.accent : theme.border}`, borderRadius: 12, padding: "8px 14px", color: n === m ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{m}</button>))}</div><input placeholder="Medicine name" value={n} onChange={e => setN(e.target.value)} style={{ ...inputStyle(theme), fontSize: 16, marginBottom: 10 }} /><div style={{ display: "flex", gap: 8, marginBottom: 16 }}><input placeholder="Dose" value={d} onChange={e => setD(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /><input type="time" value={t} onChange={e => setT(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /></div><button onClick={() => n && addLog({ type: "medicine", name: n, dose: d, date: todayStr, time: t })} disabled={!n} style={{ width: "100%", padding: 16, borderRadius: 16, background: n ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: n ? "pointer" : "default" }}>Log</button></div>);
}
function NoteModal({ theme, addLog, todayStr, now }) {
  const [n, setN] = useState(""); const [t, setT] = useState(localTimeStr(now));
  return (<div><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>📝 Note</h2><textarea placeholder="What's happening?" value={n} onChange={e => setN(e.target.value)} rows={4} style={{ ...inputStyle(theme), fontSize: 16, resize: "none", marginBottom: 10 }} /><input type="time" value={t} onChange={e => setT(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 16, textAlign: "center" }} /><button onClick={() => n && addLog({ type: "note", note: n, date: todayStr, time: t })} disabled={!n} style={{ width: "100%", padding: 16, borderRadius: 16, background: n ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: n ? "pointer" : "default" }}>Save</button></div>);
}
function TeethingModal({ theme, addLog, todayStr, now }) {
  const [tooth, setTooth] = useState(""); const [sym, setSym] = useState("");
  return (<div><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>🦷 Teething</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>{["Bottom center L","Bottom center R","Top center L","Top center R","Bottom lateral L","Bottom lateral R","Top lateral L","Top lateral R","1st molar","Canine","2nd molar"].map(t => (<button key={t} onClick={() => setTooth(t)} style={{ background: tooth === t ? theme.accentSoft : theme.bg, border: `1px solid ${tooth === t ? theme.accent : theme.border}`, borderRadius: 12, padding: "6px 12px", color: tooth === t ? theme.accent : theme.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{t}</button>))}</div><input placeholder="Symptoms" value={sym} onChange={e => setSym(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 16 }} /><button onClick={() => tooth && addLog({ type: "teething", tooth, symptoms: sym, date: todayStr, time: localTimeStr(now) })} disabled={!tooth} style={{ width: "100%", padding: 16, borderRadius: 16, background: tooth ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: tooth ? "pointer" : "default" }}>Log</button></div>);
}
function DoctorModal({ theme, data, updateData, showToast }) {
  const [d, setD]     = useState(localDateStr());
  const [w, setW]     = useState("");
  const [h, setH]     = useState("");
  const [n, setN]     = useState("");
  const [docs, setDocs] = useState([]);

  const handleSave = () => {
    const record = {
      id: uid(), date: d,
      weight: w ? parseFloat(w) : null,
      height: h ? parseFloat(h) : null,
      note: n, docs,
      timestamp: new Date().toISOString(),
    };
    updateData("pediatricianNotes", [...(data.pediatricianNotes || []), record]);
    if (w || h) updateData("growthRecords", [...(data.growthRecords || []), { id: uid(), date: d, weight: w ? parseFloat(w) : null, height: h ? parseFloat(h) : null, source: "doctor" }]);
    showToast("🩺 Saved!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, textAlign: "center" }}>🩺 Doctor Visit</h2>
      <input type="date" value={d} onChange={e => setD(e.target.value)} style={inputStyle(theme)} />
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Weight (lbs)" type="number" step="0.1" value={w} onChange={e => setW(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} />
        <input placeholder="Height (in)"  type="number" step="0.1" value={h} onChange={e => setH(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} />
      </div>
      <textarea placeholder="Notes, vaccines, concerns..." value={n} onChange={e => setN(e.target.value)} rows={3} style={{ ...inputStyle(theme), resize: "none" }} />
      <div>
        <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8, fontWeight: 700 }}>ATTACHMENTS</p>
        <DocUploadButton theme={theme} onFilesReady={(files) => setDocs(prev => [...prev, ...files])} />
        <DocGallery docs={docs} theme={theme} onDelete={(idx) => setDocs(prev => prev.filter((_, i) => i !== idx))} />
      </div>
      <button onClick={handleSave} style={{ padding: 16, borderRadius: 16, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer" }}>Save Visit</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRENDS, MILESTONES, GROWTH, COPILOT, SETTINGS, HISTORY, ACTIVITIES, FAMILY
// (Same as before, updated for poop/food integration)
// ═══════════════════════════════════════════════════════════════
function TrendsPage({ data, theme }) {
  const days = last7Days();
  const fd = days.map(d => ({ day: dayLabel(d), oz: data.logs.filter(l => l.date === d && l.type === "bottle").reduce((s, l) => s + (l.amount || 0), 0) }));
  const dd = days.map(d => { const dl = data.logs.filter(l => l.date === d); return { day: dayLabel(d), wet: dl.filter(l => l.type === "diaper").length, poop: dl.filter(l => l.type === "poop").length }; });
  const sd = days.map(d => ({ day: dayLabel(d), hours: +(data.logs.filter(l => l.date === d && l.type === "sleep" && l.durationMins).reduce((s, l) => s + (l.durationMins || 0), 0) / 60).toFixed(1) }));
  const ffd = days.map(d => ({ day: dayLabel(d), cal: data.logs.filter(l => l.date === d && l.type === "food").reduce((s, f) => s + (f.calories || 0), 0) }));
  const cs = { background: theme.card, borderRadius: 20, padding: "16px 8px 8px 0", border: `1px solid ${theme.border}`, marginBottom: 16 };
  const hs = { fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingLeft: 16, marginBottom: 8 };
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>📊 7-Day Trends</h2>
      <div style={cs}><h3 style={hs}>Feeding (oz)</h3><ResponsiveContainer width="100%" height={140}><BarChart data={fd}><CartesianGrid strokeDasharray="3 3" stroke={theme.border} /><XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={30} /><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, color: theme.text }} /><Bar dataKey="oz" fill={theme.info} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div style={cs}><h3 style={hs}>Diapers & Poops</h3><ResponsiveContainer width="100%" height={140}><BarChart data={dd}><CartesianGrid strokeDasharray="3 3" stroke={theme.border} /><XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={30} /><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, color: theme.text }} /><Bar dataKey="wet" fill={theme.info} stackId="a" name="Wet" radius={[0,0,0,0]} /><Bar dataKey="poop" fill={theme.warning} stackId="a" name="Poop" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div>
      <div style={cs}><h3 style={hs}>Sleep (hrs)</h3><ResponsiveContainer width="100%" height={140}><AreaChart data={sd}><CartesianGrid strokeDasharray="3 3" stroke={theme.border} /><XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={30} /><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, color: theme.text }} /><Area type="monotone" dataKey="hours" stroke={theme.purple} fill={`${theme.purple}40`} strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
      <div style={cs}><h3 style={hs}>Food (cal)</h3><ResponsiveContainer width="100%" height={140}><BarChart data={ffd}><CartesianGrid strokeDasharray="3 3" stroke={theme.border} /><XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={30} /><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, color: theme.text }} /><Bar dataKey="cal" fill={theme.success} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <h3 style={{ ...hs, paddingLeft: 0 }}>Averages</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
          <div><div style={{ fontSize: 20, fontWeight: 900, color: theme.info, fontFamily: "'Fredoka'" }}>{(fd.reduce((s,d)=>s+d.oz,0)/7).toFixed(1)}</div><div style={{ fontSize: 10, color: theme.textMuted }}>oz/day</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 900, color: theme.warning, fontFamily: "'Fredoka'" }}>{(dd.reduce((s,d)=>s+d.wet+d.poop,0)/7).toFixed(1)}</div><div style={{ fontSize: 10, color: theme.textMuted }}>diapers</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 900, color: theme.purple, fontFamily: "'Fredoka'" }}>{(sd.reduce((s,d)=>s+d.hours,0)/7).toFixed(1)}</div><div style={{ fontSize: 10, color: theme.textMuted }}>hrs sleep</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 900, color: theme.success, fontFamily: "'Fredoka'" }}>{Math.round(ffd.reduce((s,d)=>s+d.cal,0)/7)}</div><div style={{ fontSize: 10, color: theme.textMuted }}>cal/day</div></div>
        </div>
      </div>
    </div>
  );
}

function MilestonesPage({ data, updateData, theme, showToast }) {
  const [cat, setCat] = useState("motor");
  const [editingKey, setEditingKey] = useState(null);
  const [editDate, setEditDate] = useState("");
  const ms = data.milestones || {};

  const toggle = (c, i) => {
    const k = `${c}_${i}`;
    const u = { ...ms };
    if (u[k]) { delete u[k]; }
    else { u[k] = localDateStr(); showToast("⭐ Milestone!"); }
    updateData("milestones", u);
  };

  const startEditDate = (k, currentDate, e) => {
    e.stopPropagation();
    setEditingKey(k);
    setEditDate(currentDate || localDateStr());
  };

  const saveDate = (k) => {
    const u = { ...ms };
    u[k] = editDate;
    updateData("milestones", u);
    setEditingKey(null);
    showToast("📅 Date updated!");
  };

  const cc = Object.keys(ms).filter(k => k.startsWith(cat)).length;
  const tc = MILESTONE_CATEGORIES[cat].items.length;

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>⭐ Milestones</h2>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
        {Object.entries(MILESTONE_CATEGORIES).map(([k, c]) => (
          <button key={k} className="tab-btn" onClick={() => setCat(k)}
            style={{ background: cat === k ? theme.accentSoft : theme.card, border: `1px solid ${cat === k ? theme.accent : theme.border}`, borderRadius: 14, padding: "8px 14px", color: cat === k ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <div style={{ background: theme.card, borderRadius: 16, padding: "12px 16px", border: `1px solid ${theme.border}`, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{MILESTONE_CATEGORIES[cat].label}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: theme.accent }}>{cc}/{tc}</span>
        </div>
        <div style={{ height: 6, background: theme.bg, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(cc/tc)*100}%`, background: theme.accent, borderRadius: 6, transition: "width 0.3s" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {MILESTONE_CATEGORIES[cat].items.map(item => {
          const k = `${cat}_${item}`;
          const done = ms[k];
          const isEditing = editingKey === k;
          return (
            <div key={item} className="card"
              style={{ background: done ? theme.accentSoft : theme.card, border: `1px solid ${done ? theme.accent : theme.border}`, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }} onClick={() => toggle(cat, item)}>
                <div style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${done ? theme.accent : theme.border}`, background: done ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 800, flexShrink: 0, cursor: "pointer" }}>
                  {done ? "✓" : ""}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: done ? theme.accent : theme.text }}>{item}</span>
                  {done && !isEditing && (
                    <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 8 }}>{done}</span>
                  )}
                </div>
                {done && !isEditing && (
                  <button onClick={e => startEditDate(k, done, e)}
                    style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: 8, padding: "3px 8px", color: theme.textMuted, fontSize: 11, cursor: "pointer" }}>
                    📅
                  </button>
                )}
              </div>
              {isEditing && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                    style={{ ...inputStyle(theme), flex: 1 }} />
                  <button onClick={() => saveDate(k)}
                    style={{ padding: "8px 14px", borderRadius: 10, background: theme.accent, color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 13 }}>Save</button>
                  <button onClick={() => setEditingKey(null)}
                    style={{ padding: "8px 14px", borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GrowthPage({ data, updateData, theme, showToast, navigateBack }) {
  const [sf, setSf] = useState(false); const [w, setW] = useState(""); const [h, setH] = useState(""); const [hd, setHd] = useState(""); const [d, setD] = useState(localDateStr());
  const recs = (data.growthRecords || []).sort((a, b) => a.date.localeCompare(b.date));
  const add = () => { if (!w && !h && !hd) return; updateData("growthRecords", [...(data.growthRecords || []), { id: uid(), date: d, weight: w ? parseFloat(w) : null, height: h ? parseFloat(h) : null, head: hd ? parseFloat(hd) : null }]); setW(""); setH(""); setHd(""); setSf(false); showToast("📏 Saved!"); };
  const cd = recs.map(r => ({ date: r.date.slice(5), weight: r.weight }));
  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>📏 Growth</h2></div><button onClick={() => setSf(!sf)} style={{ background: theme.accent, color: "#fff", border: "none", borderRadius: 12, padding: "8px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{sf ? "Cancel" : "+ Add"}</button></div>
    {sf && <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, marginBottom: 16, animation: "fadeIn 0.2s" }}><input type="date" value={d} onChange={e => setD(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 10 }} /><div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input placeholder="Weight lbs" type="number" step="0.1" value={w} onChange={e => setW(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /><input placeholder="Height in" type="number" step="0.1" value={h} onChange={e => setH(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /><input placeholder="Head in" type="number" step="0.1" value={hd} onChange={e => setHd(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /></div><button onClick={add} style={{ width: "100%", padding: 14, borderRadius: 14, background: theme.accent, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" }}>Save</button></div>}
    {cd.length > 1 && <div style={{ background: theme.card, borderRadius: 20, padding: "16px 8px 8px 0", border: `1px solid ${theme.border}`, marginBottom: 16 }}><ResponsiveContainer width="100%" height={160}><LineChart data={cd}><CartesianGrid strokeDasharray="3 3" stroke={theme.border} /><XAxis dataKey="date" tick={{ fill: theme.textMuted, fontSize: 10 }} axisLine={false} /><YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={35} /><Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, color: theme.text }} /><Line type="monotone" dataKey="weight" stroke={theme.accent} strokeWidth={3} dot={{ fill: theme.accent, r: 4 }} /></LineChart></ResponsiveContainer></div>}
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{[...recs].reverse().map(r => (<div key={r.id} className="card" style={{ background: theme.card, borderRadius: 14, padding: "12px 16px", border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 700 }}>{r.date}</span><div style={{ display: "flex", gap: 16, fontSize: 13 }}>{r.weight && <span style={{ color: theme.accent }}>{r.weight} lbs</span>}{r.height && <span style={{ color: theme.info }}>{r.height} in</span>}{r.head && <span style={{ color: theme.purple }}>{r.head} in</span>}{r.source === "doctor" && <span>🩺</span>}</div></div>))}{recs.length === 0 && <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", padding: 30 }}>No records yet.</p>}</div>

    {(data.pediatricianNotes || []).length > 0 && (
      <div style={{ marginTop: 20 }}>
        <SectionLabel theme={theme}>Doctor Visit Notes & Files</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...(data.pediatricianNotes || [])].reverse().map(note => (
            <div key={note.id} style={{ background: theme.card, borderRadius: 16, padding: 16, border: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: theme.accent }}>🩺 {note.date}</span>
                {(note.weight || note.height) && (
                  <span style={{ fontSize: 12, color: theme.textMuted }}>
                    {note.weight ? `${note.weight} lbs ` : ""}{note.height ? `· ${note.height} in` : ""}
                  </span>
                )}
              </div>
              {note.note && <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.5, marginBottom: 8 }}>{note.note}</p>}
              {(note.docs || []).length > 0 && <DocGallery docs={note.docs} theme={theme} />}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>);
}

function CoPilotPage({ data, theme, updateData, showToast, todayStr }) {
  const [digest, setDigest] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("digest");

  const genDigest = async (silent = false) => {
    const key = data.settings?.aiKey, prov = data.settings?.aiProvider || "groq";
    if (!key) { if (!silent) showToast("Set AI key in Settings first", "error"); return null; }
    if (!silent) setLoading(true);
    const l7 = last7Days(), wl = data.logs.filter(l => l7.includes(l.date));
    const pp = wl.filter(l => l.type === "poop"), fl = wl.filter(l => l.type === "food");
    const sum = {
      babyName: data.baby?.name || "baby",
      bottles: wl.filter(l=>l.type==="bottle").length,
      totalOz: wl.filter(l=>l.type==="bottle").reduce((s,l)=>s+(l.amount||0),0),
      poops: pp.length, poopColors: pp.map(p=>POOP_COLORS.find(c=>c.id===p.color)?.label).filter(Boolean),
      foods: fl.map(f=>f.foodName).filter(Boolean), totalCal: fl.reduce((s,f)=>s+(f.calories||0),0),
      sleeps: wl.filter(l=>l.type==="sleep").length,
      milestones: Object.entries(data.milestones||{}).filter(([,d])=>l7.includes(d)).map(([k])=>k.split("_").slice(1).join(" ")),
      likes: (data.foodPreferences?.likes||[]).join(", "),
    };
    const prompt = `Warm baby care assistant. Write 2-3 paragraph daily digest for ${sum.babyName}'s family based on data: ${JSON.stringify(sum)}. Mention feeding, sleep, poop patterns, and food. Be warm and encouraging. End with a supportive emoji.`;
    let ep, hd, body;
    if (prov === "groq") { ep = "https://api.groq.com/openai/v1/chat/completions"; hd = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; body = { model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 700 }; }
    else if (prov === "openai") { ep = "https://api.openai.com/v1/chat/completions"; hd = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; body = { model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 700 }; }
    else if (prov === "anthropic") { ep = "https://api.anthropic.com/v1/messages"; hd = { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }; body = { model: "claude-sonnet-4-20250514", messages: [{ role: "user", content: prompt }], max_tokens: 700 }; }
    else { ep = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`; hd = { "Content-Type": "application/json" }; body = { contents: [{ parts: [{ text: prompt }] }] }; }
    try {
      const res = await fetch(ep, { method: "POST", headers: hd, body: JSON.stringify(body) });
      const j = await res.json();
      let txt = prov === "anthropic" ? j.content?.[0]?.text : prov === "gemini" ? j.candidates?.[0]?.content?.parts?.[0]?.text : j.choices?.[0]?.message?.content;
      txt = txt || "Error generating digest.";
      if (!silent) setDigest(txt);
      const entry = { id: uid(), text: txt, date: todayStr, timestamp: new Date().toISOString() };
      updateData("familyUpdates", [...(data.familyUpdates||[]), entry]);
      if (!silent) setLoading(false);
      return txt;
    } catch {
      if (!silent) { setDigest("Failed. Check API key and connection."); showToast("Failed", "error"); setLoading(false); }
      return null;
    }
  };

  // Auto-generate digest at the start of each new day (if key is set and no digest for today yet)
  useEffect(() => {
    if (!data.settings?.aiKey) return;
    const todayDigests = (data.familyUpdates||[]).filter(u => u.date === todayStr);
    if (todayDigests.length === 0) {
      // Only auto-generate after a short delay so the UI is settled
      const t = setTimeout(() => genDigest(true), 3000);
      return () => clearTimeout(t);
    }
  }, [todayStr, data.settings?.aiKey]);

  const todayDigests = (data.familyUpdates||[]).filter(u => u.date === todayStr);
  const latestToday = todayDigests[todayDigests.length - 1];

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>🤖 Baby Co-Pilot</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[{id:"digest",l:"Today"},{id:"insights",l:"Insights"},{id:"history",l:"All Digests"}].map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
            style={{ background: tab === t.id ? theme.accentSoft : theme.card, border: `1px solid ${tab === t.id ? theme.accent : theme.border}`, borderRadius: 14, padding: "8px 14px", color: tab === t.id ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "digest" && (
        <>
          {/* Auto-generation note */}
          {data.settings?.aiKey && (
            <div style={{ background: theme.accentSoft, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: theme.accent, fontWeight: 600 }}>
              ✨ Auto-generates a new digest each morning
            </div>
          )}
          {!data.settings?.aiKey && (
            <div style={{ background: `${theme.warning}18`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: theme.warning, fontWeight: 600 }}>
              ⚠️ Add your AI key in Settings to enable auto-generation
            </div>
          )}
          <button className="log-btn" onClick={() => genDigest(false)} disabled={loading}
            style={{ width: "100%", padding: 18, borderRadius: 20, background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer", marginBottom: 16, opacity: loading ? 0.7 : 1 }}>
            {loading ? "✨ Generating…" : "✨ Generate New Digest"}
          </button>

          {/* Show today's digest or newly generated one */}
          {(digest || latestToday) && (
            <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, animation: "fadeIn 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 700 }}>
                  {latestToday ? latestToday.date : todayStr}
                </span>
                <button onClick={() => { const text = digest || latestToday?.text || ""; navigator.clipboard?.writeText(text); showToast("Copied!"); }}
                  style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "5px 12px", color: theme.textMuted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                  📋 Copy
                </button>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{digest || latestToday?.text}</p>
            </div>
          )}
          <p style={{ fontSize: 11, color: theme.textMuted, textAlign: "center", marginTop: 10 }}>
            Provider: {(data.settings?.aiProvider || "groq").toUpperCase()} {data.settings?.aiProvider && data.settings.aiProvider !== "groq" ? "💲" : "(free)"}
          </p>
        </>
      )}

      {tab === "insights" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: theme.warning }}>💩 Poop Health</h3>
            <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6 }}>
              {(() => { const pp = data.logs.filter(l=>l.type==="poop"); if (pp.length < 3) return "Log more poops for insights!"; const a = pp.filter(p=>POOP_COLORS.find(c=>c.id===p.color)?.status==="alert").length; return a > 0 ? `${a} alert(s) in recent logs. Check Poop Patterns page.` : "All recent poops look healthy! 👍"; })()}
            </p>
          </div>
          <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: theme.success }}>🍎 Nutrition</h3>
            <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6 }}>
              {data.logs.filter(l=>l.type==="food").length > 3
                ? `${(data.foodPreferences?.likes||[]).length} favorite foods · ${(data.foodPreferences?.dislikes||[]).length} dislikes tracked.`
                : "Log more foods to see nutrition insights!"}
            </p>
          </div>
          <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: theme.purple }}>😴 Sleep</h3>
            <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6 }}>
              {(() => {
                const sleeps = data.logs.filter(l=>l.type==="sleep"&&l.subtype==="woke_up"&&l.durationMins);
                if (sleeps.length < 3) return "Log more sleeps for insights!";
                const avg = Math.round(sleeps.slice(-7).reduce((s,l)=>s+(l.durationMins||0),0) / Math.min(sleeps.length,7));
                return avg >= 60 ? `Avg nap: ${Math.floor(avg/60)}h ${avg%60}m over last 7 logs.` : `Avg nap: ${avg}m over last 7 logs.`;
              })()}
            </p>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(data.familyUpdates||[]).length === 0
            ? <p style={{ color: theme.textMuted, textAlign: "center", padding: 30 }}>No digests yet.</p>
            : [...(data.familyUpdates||[])].reverse().map(u => (
              <div key={u.id} style={{ background: theme.card, borderRadius: 16, padding: 16, border: `1px solid ${theme.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: theme.accent, fontWeight: 700 }}>{u.date}</p>
                  <button onClick={() => { navigator.clipboard?.writeText(u.text); showToast("Copied!"); }}
                    style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 11, cursor: "pointer" }}>📋</button>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{u.text}</p>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// AI PROVIDER SECTION — with step-by-step key setup guides
// ═══════════════════════════════════════════════════════════════
const AI_PROVIDER_GUIDES = {
  groq: {
    label: "Groq",
    badge: "FREE",
    badgeColor: "#22c55e",
    icon: "⚡",
    cost: "Completely free — no credit card needed",
    description: "Fastest option. Powered by Llama 3.3. Free tier is very generous.",
    steps: [
      { text: "Go to the Groq console", url: "https://console.groq.com/keys", linkText: "console.groq.com/keys" },
      { text: "Sign up or log in (free Google sign-in works)" },
      { text: 'Click "Create API Key"' },
      { text: 'Give it a name like "Wieser Baby"' },
      { text: "Copy the key (starts with gsk_...) and paste it below" },
    ],
    note: "The free tier handles hundreds of digests per month.",
  },
  openai: {
    label: "OpenAI",
    badge: "PAID",
    badgeColor: "#f59f00",
    icon: "🤖",
    cost: "~$0.01–0.05 per digest (very cheap)",
    description: "Uses GPT-4o Mini. Slightly better writing quality than Groq.",
    steps: [
      { text: "Go to the OpenAI API platform", url: "https://platform.openai.com/api-keys", linkText: "platform.openai.com/api-keys" },
      { text: "Sign up or log in to your OpenAI account" },
      { text: "Add a payment method under Billing (even $5 lasts months)" },
      { text: 'Click "+ Create new secret key"' },
      { text: "Copy the key (starts with sk-...) and paste it below" },
    ],
    note: "Each digest costs roughly 1–5 cents. $5 credit = 100–500 digests.",
  },
  anthropic: {
    label: "Claude (Anthropic)",
    badge: "PAID",
    badgeColor: "#f59f00",
    icon: "✳️",
    cost: "~$0.01–0.05 per digest",
    description: "Uses Claude Sonnet. Best writing quality of the four options.",
    steps: [
      { text: "Go to the Anthropic Console", url: "https://console.anthropic.com/keys", linkText: "console.anthropic.com/keys" },
      { text: "Sign up or log in" },
      { text: "Add a payment method under Billing" },
      { text: 'Click "Create Key"' },
      { text: "Copy the key (starts with sk-ant-...) and paste it below" },
    ],
    note: "Claude writes the warmest, most natural-sounding digests.",
  },
  gemini: {
    label: "Google Gemini",
    badge: "FREE TIER",
    badgeColor: "#3b82f6",
    icon: "✨",
    cost: "Free tier available — no card needed to start",
    description: "Google's AI. Free tier covers typical usage easily.",
    steps: [
      { text: "Go to Google AI Studio", url: "https://aistudio.google.com/app/apikey", linkText: "aistudio.google.com/app/apikey" },
      { text: "Sign in with your Google account" },
      { text: 'Click "Create API key"' },
      { text: 'Select "Create API key in new project" (or an existing project)' },
      { text: "Copy the key and paste it below" },
    ],
    note: "Free tier includes 15 requests/minute — more than enough for daily digests.",
  },
};

function AIProviderSection({ theme, s, us, inputStyle }) {
  const [showGuide, setShowGuide] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const guide = AI_PROVIDER_GUIDES[s.aiProvider || "groq"];
  const providers = [
    { id: "groq",      label: "⚡ Groq",    sub: "Free" },
    { id: "openai",    label: "🤖 OpenAI",  sub: "Paid" },
    { id: "anthropic", label: "✳️ Claude",  sub: "Paid" },
    { id: "gemini",    label: "✨ Gemini",  sub: "Free tier" },
  ];

  return (
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
      <SectionLabel theme={theme}>Baby Co-Pilot — AI Provider</SectionLabel>

      {/* Provider picker */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {providers.map(p => (
          <button key={p.id} onClick={() => { us("aiProvider", p.id); setShowGuide(false); }}
            style={{ background: s.aiProvider === p.id ? theme.accentSoft : theme.bg, border: `2px solid ${s.aiProvider === p.id ? theme.accent : theme.border}`, borderRadius: 14, padding: "12px 10px", cursor: "pointer", textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: s.aiProvider === p.id ? theme.accent : theme.text }}>{p.label}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
              <span style={{ background: AI_PROVIDER_GUIDES[p.id].badgeColor + "22", color: AI_PROVIDER_GUIDES[p.id].badgeColor, borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>{AI_PROVIDER_GUIDES[p.id].badge}</span>
              {" "}{AI_PROVIDER_GUIDES[p.id].cost.split("—")[0]}
            </div>
          </button>
        ))}
      </div>

      {/* API Key input */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input
          type={keyVisible ? "text" : "password"}
          placeholder={`Paste your ${guide.label} API key here`}
          value={s.aiKey || ""}
          onChange={e => us("aiKey", e.target.value)}
          style={{ ...inputStyle(theme), paddingRight: 44, fontFamily: s.aiKey ? "monospace" : "'Nunito', sans-serif", fontSize: s.aiKey ? 13 : 14 }}
        />
        <button onClick={() => setKeyVisible(v => !v)}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: theme.textMuted }}>
          {keyVisible ? "🙈" : "👁️"}
        </button>
      </div>

      {/* Status indicator */}
      {s.aiKey
        ? <p style={{ fontSize: 12, color: theme.success, fontWeight: 700, marginBottom: 12 }}>✓ API key saved</p>
        : <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12 }}>No key set — tap "How to get a key" below</p>
      }

      {/* Expandable guide */}
      <button onClick={() => setShowGuide(v => !v)}
        style={{ width: "100%", padding: "11px 16px", borderRadius: 14, background: showGuide ? theme.accentSoft : theme.bg, border: `1px solid ${showGuide ? theme.accent : theme.border}`, color: showGuide ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>📋 How to get a {guide.label} key</span>
        <span style={{ fontSize: 16, transition: "transform 0.2s", transform: showGuide ? "rotate(180deg)" : "none" }}>⌄</span>
      </button>

      {showGuide && (
        <div style={{ marginTop: 10, background: theme.bg, borderRadius: 16, padding: 16, border: `1px solid ${theme.border}`, animation: "fadeIn 0.2s" }}>
          {/* Description */}
          <p style={{ fontSize: 13, color: theme.text, marginBottom: 12, lineHeight: 1.5 }}>
            <span style={{ background: guide.badgeColor + "22", color: guide.badgeColor, borderRadius: 6, padding: "2px 8px", fontWeight: 700, fontSize: 11, marginRight: 8 }}>{guide.badge}</span>
            {guide.description}
          </p>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {guide.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: theme.accentSoft, color: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
                <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.5, margin: 0 }}>
                  {step.text}
                  {step.url && (
                    <> — <a href={step.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: theme.accent, fontWeight: 700, textDecoration: "none" }}>
                      {step.linkText} ↗
                    </a></>
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Note */}
          {guide.note && (
            <div style={{ background: theme.accentSoft, borderRadius: 10, padding: "10px 12px", borderLeft: `3px solid ${theme.accent}` }}>
              <p style={{ fontSize: 12, color: theme.text, margin: 0, lineHeight: 1.5 }}>💡 {guide.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Notification UI helpers ──────────────────────────────────
function NotifToggleRow({ label, icon, sub, enabled, onToggle, theme, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, marginBottom: enabled || last ? 0 : 12, borderBottom: (enabled || last) ? "none" : `1px solid ${theme.border}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{icon} {label}</div>
        <div style={{ fontSize: 12, color: theme.textMuted }}>{sub}</div>
      </div>
      <button onClick={onToggle}
        style={{ width: 48, height: 28, borderRadius: 14, background: enabled ? theme.accent : theme.border, border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: enabled ? 22 : 4, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s", display: "block" }} />
      </button>
    </div>
  );
}

function NotifTimesList({ label, times, defaultTime, onChange, theme, inputStyle }) {
  return (
    <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700 }}>{label}</label>
        <button onClick={() => onChange([...times, defaultTime])}
          style={{ background: theme.accentSoft, border: `1px solid ${theme.accent}`, borderRadius: 8, padding: "3px 10px", color: theme.accent, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          + Add
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {times.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="time" value={t}
              onChange={e => { const next = [...times]; next[i] = e.target.value; onChange(next); }}
              style={{ ...inputStyle(theme), flex: 1 }} />
            <button onClick={() => onChange(times.filter((_, j) => j !== i))}
              style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: 8, padding: "8px 12px", color: "#e57373", fontWeight: 700, cursor: "pointer" }}>×</button>
          </div>
        ))}
        {times.length === 0 && <p style={{ fontSize: 12, color: theme.textMuted, textAlign: "center" }}>No times set — tap "+ Add".</p>}
      </div>
    </div>
  );
}

function SettingsPage({ data, updateData, theme, showToast, navigate, activeBaby, activeBabyId, switchBaby, addBaby, setModal, reminders, setReminders, notifPermission, setNotifPermission, currentUser, setCurrentUser, handleHouseholdChange, userThemeKey, setThemePref }) {
  const s = data.settings || {}, b = activeBaby || data.baby || DEFAULT_BABY;
  const us = (k, v) => updateData("settings", { ...s, [k]: v });
  const ub = (k, v) => {
    // Update the active baby inside the babies array AND the legacy baby field
    updateData("babies", (data.babies || []).map(baby => baby.id === activeBabyId ? { ...baby, [k]: v } : baby));
    updateData("baby", { ...b, [k]: v });
  };
  return (<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>⚙️ Settings</h2>

    {/* Account card with photo change */}
    {currentUser && <AccountCard currentUser={currentUser} setCurrentUser={setCurrentUser} theme={theme} showToast={showToast} />}
    {(data.babies||[]).length > 1 && (
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <SectionLabel theme={theme}>Babies</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(data.babies||[]).map(baby => (
            <button key={baby.id} onClick={() => switchBaby(baby.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, background: baby.id === activeBabyId ? theme.accentSoft : theme.bg, border: `1px solid ${baby.id === activeBabyId ? theme.accent : theme.border}`, cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 28 }}>👶</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: baby.id === activeBabyId ? theme.accent : theme.text }}>{baby.name || "Baby"}</div>{baby.birthDate && <div style={{ fontSize: 12, color: theme.textMuted }}>{ageString(baby.birthDate)}</div>}</div>
              {baby.id === activeBabyId && <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>Active ✓</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setModal(<AddBabyModal theme={theme} addBaby={addBaby} onClose={() => setModal(null)} />)} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, background: "none", border: `1px dashed ${theme.border}`, color: theme.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Another Baby</button>
      </div>
    )}
    {(data.babies||[]).length === 1 && (
      <button onClick={() => setModal(<AddBabyModal theme={theme} addBaby={addBaby} onClose={() => setModal(null)} />)} style={{ width: "100%", padding: 12, borderRadius: 12, background: "none", border: `1px dashed ${theme.border}`, color: theme.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Another Baby</button>
    )}
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}><SectionLabel theme={theme}>Baby Profile</SectionLabel><input placeholder="Name" value={b.name === "Baby" ? "" : b.name} onChange={e => ub("name", e.target.value || "Baby")} style={{ ...inputStyle(theme), fontSize: 16, marginBottom: 10 }} /><label style={{ fontSize: 12, color: theme.textMuted, display: "block", marginBottom: 4 }}>Birth Date</label><input type="date" value={b.birthDate} onChange={e => ub("birthDate", e.target.value)} style={inputStyle(theme)} />{b.birthDate && <p style={{ fontSize: 13, color: theme.accent, marginTop: 8, fontWeight: 700 }}>{ageString(b.birthDate)}</p>}</div>
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
      <SectionLabel theme={theme}>Theme</SectionLabel>
      <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12 }}>
        🔒 Your theme is saved privately on this device — it won't affect your partner's view.
      </p>
      <button onClick={() => setThemePref("auto")} style={{ width: "100%", marginBottom: 12, padding: "12px 16px", borderRadius: 14, background: userThemeKey === "auto" ? theme.accentSoft : theme.bg, border: `2px solid ${userThemeKey === "auto" ? theme.accent : theme.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>✨</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: userThemeKey === "auto" ? theme.accent : theme.text }}>Auto (match device)</span>
        {userThemeKey === "auto" && <span style={{ marginLeft: "auto", color: theme.accent }}>✓</span>}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {Object.entries(THEMES).map(([k, t]) => (
          <button key={k} className="card" onClick={() => setThemePref(k)} style={{ background: t.bg, border: `2px solid ${userThemeKey === k ? t.accent : t.border}`, borderRadius: 16, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: t.accent }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{t.name}</div>
              <div style={{ fontSize: 10, color: t.dark ? "#888" : "#aaa" }}>{t.dark ? "Dark" : "Light"}</div>
            </div>
            {userThemeKey === k && <span style={{ color: t.accent }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
    <AIProviderSection theme={theme} s={s} us={us} inputStyle={inputStyle} userThemeKey={userThemeKey} setThemePref={setThemePref} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[{p:"growth",i:"📏",l:"Growth"},{p:"activities",i:"🎯",l:"Activities"},{p:"pooplog",i:"💩",l:"Poop Log"},{p:"family",i:"👨‍👩‍👦",l:"Family"}].map(x => (
        <button key={x.p} className="log-btn" onClick={() => navigate(x.p)}
          style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 16, cursor: "pointer", textAlign: "center", color: theme.text }}>
          <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>{x.i}</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{x.l}</div>
        </button>
      ))}
    </div>
    {currentUser && !currentUser.isAnonymous && (
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <SectionLabel theme={theme}>Partner Sync</SectionLabel>
        <HouseholdSync
          currentUser={currentUser}
          theme={theme}
          showToast={showToast}
          onHouseholdChange={handleHouseholdChange}
        />
      </div>
    )}

    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
      <SectionLabel theme={theme}>Notifications</SectionLabel>
      {notifPermission === "unsupported" && <p style={{ fontSize: 13, color: theme.textMuted }}>Notifications are not supported in this browser.</p>}
      {notifPermission !== "unsupported" && notifPermission !== "granted" && (
        <button onClick={async () => { const r = await requestNotificationPermission(); setNotifPermission(r); }}
          style={{ width: "100%", padding: 12, borderRadius: 12, background: theme.accentSoft, border: `1px solid ${theme.accent}`, color: theme.accent, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
          🔔 Enable Notifications
        </button>
      )}
      {notifPermission === "granted" && <p style={{ fontSize: 12, color: theme.success, fontWeight: 700, marginBottom: 12 }}>✓ Notifications enabled</p>}

      {/* ── Feeding ── */}
      <NotifToggleRow label="Feeding Reminder" icon="🍼" sub="Remind me to feed baby"
        enabled={reminders.feedingEnabled} onToggle={() => setReminders(r => ({ ...r, feedingEnabled: !r.feedingEnabled }))} theme={theme} />
      {reminders.feedingEnabled && (
        <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${theme.border}` }}>
          <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700 }}>REMIND EVERY</label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {[[60,"1 hr"],[120,"2 hr"],[180,"3 hr"],[240,"4 hr"]].map(([mins, lbl]) => (
              <button key={mins} onClick={() => setReminders(r => ({ ...r, feedingMins: mins }))}
                style={{ flex: 1, padding: "8px 4px", borderRadius: 10, background: reminders.feedingMins === mins ? theme.accentSoft : theme.bg, border: `1px solid ${reminders.feedingMins === mins ? theme.accent : theme.border}`, color: reminders.feedingMins === mins ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Medicine ── */}
      <NotifToggleRow label="Medicine Reminder" icon="💊" sub="Alert at custom medicine times"
        enabled={reminders.medicineEnabled} onToggle={() => setReminders(r => ({ ...r, medicineEnabled: !r.medicineEnabled }))} theme={theme} />
      {reminders.medicineEnabled && (
        <NotifTimesList
          label="MEDICINE TIMES"
          times={reminders.medicineTimes || []}
          defaultTime="08:00"
          onChange={times => setReminders(r => ({ ...r, medicineTimes: times }))}
          theme={theme}
          inputStyle={inputStyle}
        />
      )}

      {/* ── Nap ── */}
      <NotifToggleRow label="Nap Reminder" icon="😴" sub="Alert at custom nap times"
        enabled={reminders.napEnabled} onToggle={() => setReminders(r => ({ ...r, napEnabled: !r.napEnabled }))} theme={theme} />
      {reminders.napEnabled && (
        <NotifTimesList
          label="NAP TIMES"
          times={reminders.napTimes || []}
          defaultTime="12:00"
          onChange={times => setReminders(r => ({ ...r, napTimes: times }))}
          theme={theme}
          inputStyle={inputStyle}
        />
      )}

      {/* ── Do Not Disturb ── */}
      <NotifToggleRow label="Do Not Disturb" icon="🌙" sub="Silence all notifications during set hours"
        enabled={reminders.dndEnabled} onToggle={() => setReminders(r => ({ ...r, dndEnabled: !r.dndEnabled }))} theme={theme} last />
      {reminders.dndEnabled && (
        <div style={{ background: theme.bg, borderRadius: 14, padding: 14, border: `1px solid ${theme.border}`, marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, marginBottom: 10 }}>
            QUIET HOURS — no notifications will fire between these times
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 4 }}>FROM</label>
              <input type="time" value={reminders.dndStart || "21:00"}
                onChange={e => setReminders(r => ({ ...r, dndStart: e.target.value }))}
                style={inputStyle(theme)} />
            </div>
            <span style={{ color: theme.textMuted, fontSize: 18, marginTop: 14 }}>→</span>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 4 }}>TO</label>
              <input type="time" value={reminders.dndEnd || "07:00"}
                onChange={e => setReminders(r => ({ ...r, dndEnd: e.target.value }))}
                style={inputStyle(theme)} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 8, lineHeight: 1.4 }}>
            💡 Times wrap overnight — e.g. 21:00 → 07:00 silences from 9 PM to 7 AM.
          </p>
        </div>
      )}
    </div>
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}><SectionLabel theme={theme}>Data</SectionLabel><div style={{ display: "flex", gap: 10 }}><button onClick={() => { const bl = new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const u = URL.createObjectURL(bl); const a = document.createElement("a"); a.href = u; a.download = `wieser-baby-${localDateStr()}.json`; a.click(); URL.revokeObjectURL(u); showToast("Downloaded!"); }} style={{ flex: 1, padding: 14, borderRadius: 14, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📦 Export</button><button onClick={() => { if (window.confirm("Clear ALL data?")) { updateData("logs",[]); updateData("milestones",{}); updateData("growthRecords",[]); updateData("familyUpdates",[]); updateData("pediatricianNotes",[]); updateData("foodPreferences",{likes:[],dislikes:[]}); showToast("Cleared"); } }} style={{ flex: 1, padding: 14, borderRadius: 14, background: "rgba(229,115,115,0.1)", border: "1px solid rgba(229,115,115,0.3)", color: "#e57373", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🗑️ Clear</button></div></div>
    <div style={{ textAlign: "center", padding: 20, color: theme.textMuted }}><p style={{ fontFamily: "'Fredoka'", fontSize: 16 }}><span style={{ color: theme.accent }}>Wieser</span> Baby</p><p style={{ fontSize: 12, marginTop: 4 }}>v{APP_VERSION}</p></div>
  </div>);
}


// ─── SLEEP EDIT FIELDS ───────────────────────────────────────
// Used inside EditLogModal for woke_up sleep logs.
// Derives start time from end time − durationMins.
// Editing start or end time auto-recalculates duration.
function SleepEditFields({ fields, set, theme, log, is }) {
  // Derive start time: end time (fields.time on fields.date) minus durationMins
  const deriveStartTime = (endDateStr, endTimeStr, durationMins) => {
    if (!endDateStr || !endTimeStr) return { date: endDateStr || localDateStr(), time: "00:00" };
    const end = new Date(`${endDateStr}T${endTimeStr}`);
    const start = new Date(end.getTime() - (durationMins || 0) * 60000);
    return {
      date: localDateStr(start),
      time: localTimeStr(start),
    };
  };

  const derived = deriveStartTime(fields.date, fields.time, fields.durationMins);
  const [startDate, setStartDate] = useState(derived.date);
  const [startTime, setStartTime] = useState(derived.time);

  const recalc = (newStartDate, newStartTime, newEndDate, newEndTime) => {
    if (!newStartDate || !newStartTime || !newEndDate || !newEndTime) return;
    const start = new Date(`${newStartDate}T${newStartTime}`);
    const end   = new Date(`${newEndDate}T${newEndTime}`);
    const mins  = Math.round((end - start) / 60000);
    if (mins > 0) set("durationMins", mins);
  };

  const handleStartDate = (v) => { setStartDate(v); recalc(v, startTime, fields.date, fields.time); };
  const handleStartTime = (v) => { setStartTime(v); recalc(startDate, v, fields.date, fields.time); };
  const handleEndDate   = (v) => { set("date", v);  recalc(startDate, startTime, v, fields.time); };
  const handleEndTime   = (v) => { set("time", v);  recalc(startDate, startTime, fields.date, v); };

  const durMins = fields.durationMins || 0;
  const durLabel = durMins >= 60
    ? `${Math.floor(durMins / 60)}h ${durMins % 60}m`
    : `${durMins}m`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Start */}
      <div>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 6 }}>
          😴 FELL ASLEEP
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" value={startDate} onChange={e => handleStartDate(e.target.value)} style={{ ...is, flex: 1 }} />
          <input type="time" value={startTime} onChange={e => handleStartTime(e.target.value)} style={{ ...is, flex: 1 }} />
        </div>
      </div>

      {/* End */}
      <div>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 6 }}>
          ☀️ WOKE UP
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" value={fields.date || ""} onChange={e => handleEndDate(e.target.value)} style={{ ...is, flex: 1 }} />
          <input type="time" value={fields.time || ""} onChange={e => handleEndTime(e.target.value)} style={{ ...is, flex: 1 }} />
        </div>
      </div>

      {/* Duration display + manual override */}
      <div style={{ background: theme.bg, borderRadius: 14, padding: "14px 16px", border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700 }}>DURATION</label>
          <span style={{ fontSize: 22, fontWeight: 900, color: theme.purple, fontFamily: "'Fredoka', sans-serif" }}>
            {durLabel}
          </span>
        </div>
        <input
          type="number"
          value={durMins}
          onChange={e => set("durationMins", Math.max(0, parseInt(e.target.value) || 0))}
          style={{ ...is, textAlign: "center" }}
          placeholder="Override minutes"
        />
        <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 6, textAlign: "center" }}>
          Auto-calculated from start/end · or type to override
        </p>
      </div>
    </div>
  );
}

// ─── FOOD EDIT FIELDS ────────────────────────────────────────
// Used inside EditLogModal for food logs.
// Scales macros automatically when serving size changes.
function FoodEditFields({ fields, set, theme, log, is }) {
  // Derive per-unit nutrition from the original log
  const origQty = parseServingNum(log.servingSize) || 1;
  const baseRef = useRef({
    calories: (log.calories || 0) / origQty,
    protein:  (log.protein  || 0) / origQty,
    carbs:    (log.carbs    || 0) / origQty,
    fat:      (log.fat      || 0) / origQty,
    fiber:    (log.fiber    || 0) / origQty,
    sugar:    (log.sugar    || 0) / origQty,
  });

  const handleServingChange = (newSv) => {
    set("servingSize", newSv);
    const qty = parseServingNum(newSv);
    if (!qty || qty <= 0) return;
    const b = baseRef.current;
    const r1 = (n) => Math.round(n * qty * 10) / 10;
    set("calories", Math.round(b.calories * qty));
    set("protein",  r1(b.protein));
    set("carbs",    r1(b.carbs));
    set("fat",      r1(b.fat));
    set("fiber",    r1(b.fiber));
    set("sugar",    r1(b.sugar));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input placeholder="Food name" value={fields.foodName || ""}
        onChange={e => set("foodName", e.target.value)}
        style={{ ...is, fontWeight: 700 }} />

      <div>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 4 }}>
          SERVING SIZE
          {origQty > 0 && <span style={{ fontWeight: 400, marginLeft: 8 }}>— macros auto-scale with quantity</span>}
        </label>
        <input
          placeholder={`e.g. ${log.servingSize || "1 cup"}`}
          value={fields.servingSize || ""}
          onChange={e => handleServingChange(e.target.value)}
          style={is}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[["calories","Cal kcal"],["protein","Protein g"],["carbs","Carbs g"],["fat","Fat g"],["fiber","Fiber g"],["sugar","Sugar g"]].map(([k, lbl]) => (
          <div key={k}>
            <label style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 2 }}>{lbl.toUpperCase()}</label>
            <input type="number" step="0.1" value={fields[k] ?? ""}
              onChange={e => set(k, parseFloat(e.target.value) || 0)}
              style={is} />
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: theme.textMuted, textAlign: "center" }}>
        Serving size scales macros automatically · edit any field to override
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EDIT LOG MODAL — handles all log types
// ═══════════════════════════════════════════════════════════════
function EditLogModal({ theme, log, onSave, onClose, now }) {
  const is = inputStyle(theme);
  const [fields, setFields] = useState({ ...log });
  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 4, textAlign: "center" }}>
        ✏️ Edit {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
      </h2>
      <p style={{ fontSize: 12, color: theme.textMuted, textAlign: "center", marginBottom: 20 }}>{log.date} · {formatTime12(log.time)}</p>

      {/* Date + time — common to all except sleep (which has its own start/end fields) */}
      {log.type !== "sleep" && (
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 4 }}>DATE</label>
          <input type="date" value={fields.date || ""} onChange={e => set("date", e.target.value)} style={is} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 4 }}>TIME</label>
          <input type="time" value={fields.time || ""} onChange={e => set("time", e.target.value)} style={is} />
        </div>
      </div>
      )}

      {/* ── Bottle ── */}
      {log.type === "bottle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 4 }}>AMOUNT (oz)</label>
            <input type="number" step="0.5" value={fields.amount || ""} onChange={e => set("amount", parseFloat(e.target.value))} style={{ ...is, fontSize: 20, textAlign: "center" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 6 }}>TYPE</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["formula","breast","milk","water","juice"].map(t => (
                <button key={t} onClick={() => set("feedType", t)} style={{ padding: "8px 14px", borderRadius: 10, background: fields.feedType === t ? theme.accentSoft : theme.bg, border: `1px solid ${fields.feedType === t ? theme.accent : theme.border}`, color: fields.feedType === t ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sleep ── */}
      {log.type === "sleep" && log.subtype === "woke_up" && (
        <SleepEditFields fields={fields} set={set} theme={theme} log={log} is={is} />
      )}

      {/* ── Food ── */}
      {log.type === "food" && (
        <FoodEditFields fields={fields} set={set} theme={theme} log={log} is={is} />
      )}

      {/* ── Medicine ── */}
      {log.type === "medicine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="Medicine name" value={fields.name || ""} onChange={e => set("name", e.target.value)} style={is} />
          <input placeholder="Dose" value={fields.dose || ""} onChange={e => set("dose", e.target.value)} style={is} />
        </div>
      )}

      {/* ── Poop ── */}
      {log.type === "poop" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 6 }}>COLOR</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {POOP_COLORS.map(c => (
                <button key={c.id} onClick={() => set("color", c.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, background: fields.color === c.id ? `${c.hex}20` : theme.bg, border: `2px solid ${fields.color === c.id ? c.hex : theme.border}`, cursor: "pointer" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: c.hex }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: theme.text }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 6 }}>CONSISTENCY</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {POOP_CONSISTENCIES.map(c => (
                <button key={c.id} onClick={() => set("consistency", c.id)} style={{ padding: "6px 10px", borderRadius: 10, background: fields.consistency === c.id ? theme.accentSoft : theme.bg, border: `1px solid ${fields.consistency === c.id ? theme.accent : theme.border}`, cursor: "pointer", fontSize: 12, fontWeight: 700, color: fields.consistency === c.id ? theme.accent : theme.textMuted }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
          <input placeholder="Notes" value={fields.notes || ""} onChange={e => set("notes", e.target.value)} style={is} />
        </div>
      )}

      {/* ── Note ── */}
      {log.type === "note" && (
        <textarea rows={4} value={fields.note || ""} onChange={e => set("note", e.target.value)} style={{ ...is, resize: "none" }} />
      )}

      {/* ── Teething ── */}
      {log.type === "teething" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, display: "block", marginBottom: 6 }}>TOOTH</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Bottom center L","Bottom center R","Top center L","Top center R","Bottom lateral L","Bottom lateral R","Top lateral L","Top lateral R","1st molar","Canine","2nd molar"].map(t => (
                <button key={t} onClick={() => set("tooth", t)} style={{ padding: "6px 10px", borderRadius: 10, background: fields.tooth === t ? theme.accentSoft : theme.bg, border: `1px solid ${fields.tooth === t ? theme.accent : theme.border}`, cursor: "pointer", fontSize: 11, fontWeight: 700, color: fields.tooth === t ? theme.accent : theme.textMuted }}>{t}</button>
              ))}
            </div>
          </div>
          <input placeholder="Symptoms" value={fields.symptoms || ""} onChange={e => set("symptoms", e.target.value)} style={is} />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 14, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        <button onClick={() => onSave(fields)} style={{ flex: 2, padding: 14, borderRadius: 14, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer" }}>Save Changes</button>
      </div>
    </div>
  );
}

function HistoryPage({ data, theme, updateData, navigateBack, showToast, setModal, addLog, now }) {
  const [fd, setFd] = useState(localDateStr());
  const [ft, setFt] = useState("all");

  const logs = [...data.logs]
    .filter(l => l.date === fd && (ft === "all" || l.type === ft))
    .reverse();

  const logLabel = (l) => {
    if (l.type === "bottle") return `${l.amount} oz ${l.feedType || ""}`;
    if (l.type === "poop") return `${POOP_COLORS.find(c=>c.id===l.color)?.label || ""} / ${POOP_CONSISTENCIES.find(c=>c.id===l.consistency)?.label || ""}`;
    if (l.type === "diaper") return "Wet diaper";
    if (l.type === "sleep") return l.subtype === "woke_up"
      ? (l.durationMins >= 60 ? `Slept ${Math.floor((l.durationMins||0)/60)}h ${(l.durationMins||0)%60}m` : `Slept ${l.durationMins||0}m`)
      : "Fell asleep";
    if (l.type === "food") return `${l.foodName || ""} (${l.calories || 0} cal)`;
    if (l.type === "medicine") return `${l.name} ${l.dose || ""}`;
    if (l.type === "teething") return `Tooth - ${l.tooth || ""}`;
    return l.note?.slice(0, 40) || "Note";
  };

  const openEdit = (log) => {
    setModal(
      <EditLogModal
        theme={theme}
        log={log}
        onSave={(updated) => {
          updateData("logs", data.logs.map(x => x.id === log.id ? { ...x, ...updated } : x));
          showToast("✏️ Updated!");
          setModal(null);
        }}
        onClose={() => setModal(null)}
        now={now}
      />
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button>
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>📅 History</h2>
      </div>
      <input type="date" value={fd} onChange={e => setFd(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all","bottle","poop","diaper","sleep","food","medicine","note","teething"].map(t => (
          <button key={t} className="tab-btn" onClick={() => setFt(t)}
            style={{ background: ft === t ? theme.accentSoft : theme.card, border: `1px solid ${ft === t ? theme.accent : theme.border}`, borderRadius: 10, padding: "6px 12px", color: ft === t ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 11, textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>
      {logs.length === 0
        ? <p style={{ color: theme.textMuted, textAlign: "center", padding: 30 }}>No logs for this day.</p>
        : logs.map(l => (
          <div key={l.id} style={{ background: theme.card, borderRadius: 14, padding: "12px 16px", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{logIcon(l.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{logLabel(l)}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{formatTime12(l.time)}</div>
            </div>
            <button
              onClick={() => openEdit(l)}
              style={{ background: theme.accentSoft, border: `1px solid ${theme.accent}40`, borderRadius: 8, padding: "6px 12px", color: theme.accent, fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
              ✏️ Edit
            </button>
            <button
              onClick={() => { if (window.confirm("Delete this log?")) { updateData("logs", data.logs.filter(x => x.id !== l.id)); showToast("Deleted"); } }}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: theme.textMuted, flexShrink: 0, lineHeight: 1 }}>
              ✕
            </button>
          </div>
        ))
      }
    </div>
  );
}

function ActivitiesPage({ data, theme, navigateBack }) {
  const ageM = daysOld(data.baby.birthDate) ? Math.floor(daysOld(data.baby.birthDate) / 30.44) : 3;
  const all = [
    { r: [0,3], t: "0-3 Months", a: [{i:"🎵",n:"Tummy Time",d:"Start 2-3min with music"},{i:"👀",n:"Visual Tracking",d:"Move bright toy side to side"},{i:"🪞",n:"Mirror Play",d:"Baby meets baby!"},{i:"🎶",n:"Sing Songs",d:"Nursery rhymes with motions"}]},
    { r: [3,6], t: "3-6 Months", a: [{i:"🧸",n:"Reach & Grab",d:"Toys just within reach"},{i:"🫧",n:"Bubbles",d:"Track and reach for bubbles"},{i:"🎨",n:"Sensory Play",d:"Different textures to feel"},{i:"✈️",n:"Airplane",d:"Gentle lifts for giggles!"}]},
    { r: [6,12], t: "6-12 Months", a: [{i:"👋",n:"Peekaboo",d:"Object permanence!"},{i:"📦",n:"Container Play",d:"In and out, endlessly fun"},{i:"📚",n:"Flap Books",d:"Interactive reading"},{i:"🏊",n:"Water Play",d:"Splash time with cups"}]},
    { r: [12,24], t: "1-2 Years", a: [{i:"🖍️",n:"Coloring",d:"Big crayons, big paper"},{i:"🧱",n:"Blocks",d:"Stack and knock down"},{i:"🎨",n:"Finger Paint",d:"Messy but magical"},{i:"🧩",n:"Puzzles",d:"Chunky 3-5 pieces"}]},
    { r: [24,48], t: "2-4 Years", a: [{i:"🎭",n:"Pretend Play",d:"Kitchen, doctor, store"},{i:"🌱",n:"Gardening",d:"Plant seeds together"},{i:"🍳",n:"Cooking",d:"Stirring, pouring, measuring"},{i:"🏃",n:"Obstacle Course",d:"Pillows and tunnels!"}]},
    { r: [48,72], t: "4-6 Years", a: [{i:"🔬",n:"Science",d:"Vinegar volcanoes!"},{i:"♟️",n:"Board Games",d:"Turns and counting"},{i:"🚲",n:"Bike Riding",d:"Balance bike adventures"},{i:"📚",n:"Early Reading",d:"Sight word games"}]},
  ];
  const rel = all.filter(a => ageM >= a.r[0]-1 && ageM <= a.r[1]+3);
  const show = rel.length > 0 ? rel : all;
  return (<div><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}><button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>🎯 Activities</h2></div>
    {data.baby.birthDate && <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>For {ageString(data.baby.birthDate)}</p>}
    {show.map(g => (<div key={g.t} style={{ marginBottom: 20 }}><h3 style={{ fontSize: 16, fontWeight: 800, color: theme.accent, marginBottom: 10 }}>{g.t}</h3><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{g.a.map(a => (<div key={a.n} className="card" style={{ background: theme.card, borderRadius: 16, padding: "14px 16px", border: `1px solid ${theme.border}`, display: "flex", gap: 14, alignItems: "flex-start" }}><span style={{ fontSize: 28, flexShrink: 0 }}>{a.i}</span><div><div style={{ fontSize: 14, fontWeight: 800 }}>{a.n}</div><div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5, marginTop: 2 }}>{a.d}</div></div></div>))}</div></div>))}
  </div>);
}

function FamilyPage({ data, updateData, theme, navigateBack, showToast }) {
  const [n, setN] = useState(""); const [r, setR] = useState(""); const m = data.settings?.familyMembers || [];
  return (<div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}><button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>👨‍👩‍👦 Family</h2></div>
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, marginBottom: 16 }}><SectionLabel theme={theme}>Add Member</SectionLabel><input placeholder="Name" value={n} onChange={e => setN(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 8 }} /><input placeholder="Relation" value={r} onChange={e => setR(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 12 }} /><button onClick={() => { if (!n) return; updateData("settings", { ...data.settings, familyMembers: [...m, { id: uid(), name: n, relation: r }] }); setN(""); setR(""); showToast("Added!"); }} disabled={!n} style={{ width: "100%", padding: 14, borderRadius: 14, background: n ? theme.accent : theme.border, color: "#fff", fontWeight: 800, border: "none", cursor: n ? "pointer" : "default" }}>Add</button></div>
    {m.map(x => (<div key={x.id} className="card" style={{ background: theme.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div><div style={{ fontSize: 14, fontWeight: 700 }}>{x.name}</div>{x.relation && <div style={{ fontSize: 12, color: theme.textMuted }}>{x.relation}</div>}</div><button onClick={() => updateData("settings", { ...data.settings, familyMembers: m.filter(y => y.id !== x.id) })} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted }}>✕</button></div>))}
    {m.length === 0 && <p style={{ color: theme.textMuted, textAlign: "center", padding: 20 }}>No family yet.</p>}
    {(data.familyUpdates||[]).length > 0 && <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, marginTop: 16 }}><SectionLabel theme={theme}>Latest Digest</SectionLabel><p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{data.familyUpdates[data.familyUpdates.length-1].text.slice(0,200)}...</p><button onClick={() => { navigator.clipboard?.writeText(data.familyUpdates[data.familyUpdates.length-1].text); showToast("Copied!"); }} style={{ marginTop: 12, width: "100%", padding: 14, borderRadius: 14, background: theme.accentSoft, border: `1px solid ${theme.accent}`, color: theme.accent, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>📋 Copy to Share</button></div>}
  </div>);
}

// ─── BABY SWITCHER MODAL ──────────────────────────────────────
function BabySwitcherModal({ babies, activeBabyId, switchBaby, addBaby, theme }) {
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16, textAlign: "center" }}>👶 Switch Baby</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(babies || []).map(baby => (
          <button key={baby.id} onClick={() => switchBaby(baby.id)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 16, background: baby.id === activeBabyId ? theme.accentSoft : theme.card, border: `2px solid ${baby.id === activeBabyId ? theme.accent : theme.border}`, cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 32 }}>👶</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: baby.id === activeBabyId ? theme.accent : theme.text }}>{baby.name || "Baby"}</div>
              {baby.birthDate && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{ageString(baby.birthDate)}</div>}
            </div>
            {baby.id === activeBabyId && <span style={{ fontSize: 20 }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ADD BABY MODAL ───────────────────────────────────────────
function AddBabyModal({ theme, addBaby, onClose }) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    addBaby(name.trim(), birthDate);
    onClose();
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>👶 Add Baby</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          placeholder="Baby's name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ ...inputStyle(theme), fontSize: 16 }}
          autoFocus
        />
        <div>
          <label style={{ fontSize: 12, color: theme.textMuted, display: "block", marginBottom: 4 }}>Birth Date</label>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={inputStyle(theme)} />
        </div>
        <button onClick={handleAdd} disabled={!name.trim()}
          style={{ padding: 16, borderRadius: 14, background: name.trim() ? theme.accent : theme.border, color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: name.trim() ? "pointer" : "default", marginTop: 4 }}>
          Add {name || "Baby"}
        </button>
      </div>
    </div>
  );
}

// ─── ACCOUNT CARD (Settings) ──────────────────────────────────
function AccountCard({ currentUser, setCurrentUser, theme, showToast }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      // Resize to 256×256 before storing — keeps the Auth profile URL small
      const resized = await new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const SIZE = 256;
          const canvas = document.createElement("canvas");
          canvas.width = SIZE; canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          // Centre-crop to square
          const min = Math.min(img.width, img.height);
          const sx = (img.width  - min) / 2;
          const sy = (img.height - min) / 2;
          ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = url;
      });

      const updatedUser = await updateUserProfile({ photoURL: resized });
      // Firebase Auth caches the user object — force a refresh via a shallow clone
      setCurrentUser({ ...currentUser, photoURL: resized });
      showToast("📸 Photo updated!");
    } catch (err) {
      showToast("Failed to update photo", "error");
      console.error(err);
    }
    setUploading(false);
    e.target.value = "";
  };

  const photoSrc = currentUser.photoURL || null;

  return (
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
      <SectionLabel theme={theme}>My Account</SectionLabel>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>

        {/* Avatar with camera overlay */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: theme.accentSoft, border: `2px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
            {photoSrc
              ? <img src={photoSrc} alt="profile" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : "👤"
            }
          </div>
          {/* Camera button overlay */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: theme.accent, border: `2px solid ${theme.card}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, cursor: "pointer", padding: 0 }}
            title="Change photo"
          >
            {uploading ? "⏳" : "📷"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handlePhotoChange} style={{ display: "none" }} />
        </div>

        {/* Name + email */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentUser.displayName || "My Account"}
          </div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentUser.email || (currentUser.isAnonymous ? "Anonymous user" : "")}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ marginTop: 8, padding: "5px 12px", borderRadius: 8, background: theme.accentSoft, border: `1px solid ${theme.accent}`, color: theme.accent, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
          >
            {uploading ? "Uploading…" : "Change Photo"}
          </button>
        </div>

        {/* Sign out */}
        <button
          onClick={async () => {
            if (!window.confirm("Sign out?")) return;
            await logOut();
            setCurrentUser(null);
          }}
          style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(229,115,115,0.12)", border: "1px solid rgba(229,115,115,0.3)", color: "#e57373", fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0, alignSelf: "flex-start" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
