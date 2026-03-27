import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, PieChart, Pie, Cell } from "recharts";
import { ensureSignedIn, loadUserData, saveUserData, subscribeToUserData } from "./firebase.js";

// ─── Constants & Config ───────────────────────────────────────
const APP_VERSION = "1.3.0";
const THEMES = {
  midnight: { bg: "#07080d", card: "#12141c", cardHover: "#1a1d28", border: "#1e2130", accent: "#f4845f", accentSoft: "rgba(244,132,95,0.15)", text: "#e8e6e3", textMuted: "#7a7d8c", success: "#88d8b0", warning: "#f6ae2d", info: "#7eb8da", purple: "#b8a9c9", name: "Midnight" },
  ocean: { bg: "#060d14", card: "#0c1a28", cardHover: "#122234", border: "#1a2e42", accent: "#4fc3f7", accentSoft: "rgba(79,195,247,0.15)", text: "#dce8f0", textMuted: "#5a7a90", success: "#81c784", warning: "#ffb74d", info: "#64b5f6", purple: "#ab99c7", name: "Ocean" },
  blossom: { bg: "#faf5f2", card: "#ffffff", cardHover: "#fef7f4", border: "#f0e4de", accent: "#e8766a", accentSoft: "rgba(232,118,106,0.12)", text: "#2d2420", textMuted: "#8a7e78", success: "#6dbd8a", warning: "#e8a84c", info: "#6ba3c4", purple: "#a18dbf", name: "Blossom" },
  forest: { bg: "#080d08", card: "#111a11", cardHover: "#182218", border: "#1e2e1e", accent: "#8bc34a", accentSoft: "rgba(139,195,74,0.15)", text: "#dce8dc", textMuted: "#5a7a5a", success: "#a5d6a7", warning: "#dce775", info: "#80cbc4", purple: "#b39ddb", name: "Forest" },
};

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

// ─── Storage (Firebase + localStorage fallback) ───────────────
let _uid = null;
const getUid = async () => { if (!_uid) _uid = await ensureSignedIn(); return _uid; };
const loadData = async () => { try { const uid = await getUid(); return await loadUserData(uid); } catch { return null; } };
const saveData = async (data) => { try { const uid = await getUid(); await saveUserData(uid, data); } catch (e) { console.error("Save failed:", e); } };

const DEFAULT_DATA = {
  baby: { ...DEFAULT_BABY }, logs: [], milestones: {}, growthRecords: [],
  settings: { theme: "midnight", aiProvider: "groq", aiKey: "", familyMembers: [] },
  familyUpdates: [], sleepState: null, pediatricianNotes: [],
  foodPreferences: { likes: [], dislikes: [] },
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function WieserBabyApp() {
  const [page, setPage] = useState("dashboard");
  const [pageHistory, setPageHistory] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(new Date());

  const theme = data?.settings?.theme ? THEMES[data.settings.theme] : THEMES.midnight;

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);

  // Load from Firebase on mount + subscribe to real-time updates (caregiver sync)
  useEffect(() => {
    let unsub = null;
    (async () => {
      const d = await loadData();
      setData(d || JSON.parse(JSON.stringify(DEFAULT_DATA)));
      setLoading(false);
      // Subscribe to live updates after initial load
      const uid = await getUid();
      unsub = subscribeToUserData(uid, (fresh) => {
        setData(prev => {
          // Only update if the incoming data is actually different (avoid save loops)
          if (JSON.stringify(prev) !== JSON.stringify(fresh)) return fresh;
          return prev;
        });
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => { if (data && !loading) saveData(data); }, [data, loading]);

  const navigate = useCallback((p) => { setPageHistory(h => [...h, page]); setPage(p); }, [page]);
  const navigateBack = useCallback(() => { setPageHistory(h => { const n = [...h]; const prev = n.pop() || "dashboard"; setPage(prev); return n; }); }, []);
  useEffect(() => { const handler = (e) => { e.preventDefault(); navigateBack(); }; window.addEventListener("popstate", handler); return () => window.removeEventListener("popstate", handler); }, [navigateBack]);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };
  const addLog = (log) => {
    setData(d => ({ ...d, logs: [...d.logs, { ...log, id: uid(), timestamp: new Date().toISOString() }] }));
    const icons = { bottle: '🍼', diaper: '💧', sleep: '😴', medicine: '💊', poop: '💩', food: '🍎', teething: '🦷' };
    showToast(`${icons[log.type] || '📝'} Logged!`);
    setModal(null);
  };
  const updateData = (key, value) => setData(d => ({ ...d, [key]: value }));

  if (loading || !data) return (
    <div style={{ background: "#07080d", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48, animation: "pulse 1.5s ease-in-out infinite" }}>👶</div>
      <div style={{ color: "#7a7d8c", fontFamily: "'Nunito', sans-serif", fontSize: 14 }}>Loading Wieser Baby...</div>
    </div>
  );

  const todayStr = localDateStr(now);
  const todayLogs = data.logs.filter(l => l.date === todayStr);
  const commonProps = { data, theme, updateData, showToast, addLog, todayStr, now, setModal, navigate, navigateBack, todayLogs };

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
      <div style={{ fontFamily: "'Nunito', sans-serif", background: theme.bg, color: theme.text, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 90 }}>
        {/* Header */}
        <header style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, background: `linear-gradient(${theme.bg}, ${theme.bg}ee)`, backdropFilter: "blur(12px)" }}>
          <div>
            <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              <span style={{ color: theme.accent }}>Wieser</span> Baby
            </h1>
            {data.baby.name !== "Baby" && <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{data.baby.name} {data.baby.birthDate ? `\u00B7 ${ageString(data.baby.birthDate)}` : ""}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {data.sleepState && <div style={{ background: theme.accentSoft, color: theme.accent, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, animation: "pulse 2s ease-in-out infinite" }}>😴 Sleeping</div>}
            <div style={{ fontSize: 11, color: theme.textMuted, background: theme.card, padding: "4px 10px", borderRadius: 12, border: `1px solid ${theme.border}` }}>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
          </div>
        </header>

        <main style={{ padding: "0 16px 16px", animation: "fadeIn 0.25s ease" }}>
          {page === "dashboard" && <DashboardPage {...commonProps} />}
          {page === "trends" && <TrendsPage {...commonProps} />}
          {page === "food" && <FoodPage {...commonProps} />}
          {page === "milestones" && <MilestonesPage {...commonProps} />}
          {page === "copilot" && <CoPilotPage {...commonProps} />}
          {page === "settings" && <SettingsPage {...commonProps} />}
          {page === "growth" && <GrowthPage {...commonProps} />}
          {page === "history" && <HistoryPage {...commonProps} />}
          {page === "activities" && <ActivitiesPage {...commonProps} />}
          {page === "family" && <FamilyPage {...commonProps} />}
          {page === "pooplog" && <PoopLogPage {...commonProps} />}
        </main>

        {/* Bottom Nav */}
        <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: `${theme.card}f5`, backdropFilter: "blur(16px)", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-around", padding: `8px 4px calc(8px + env(safe-area-inset-bottom, 0px))`, zIndex: 100 }}>
          {NAV_ITEMS.map(n => (
            <button key={n.id} className="nav-btn" onClick={() => { setPageHistory([]); setPage(n.id); }} style={{ background: page === n.id ? theme.accentSoft : "transparent", border: "none", borderRadius: 14, padding: "6px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 52 }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: page === n.id ? theme.accent : theme.textMuted }}>{n.label}</span>
            </button>
          ))}
        </nav>

        {modal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
            <div style={{ background: theme.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "88vh", overflow: "auto", animation: "slideUp 0.25s ease", padding: "24px 20px calc(20px + env(safe-area-inset-bottom, 0px))" }}>{modal}</div>
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
      const mins = Math.floor((now - new Date(data.sleepState.startTime)) / 60000);
      addLog({ type: "sleep", subtype: "woke_up", date: todayStr, time: localTimeStr(now), durationMins: mins });
      updateData("sleepState", null);
    } else { updateData("sleepState", { startTime: now.toISOString() }); showToast("😴 Sleep timer started"); }
  };
  const sleepDur = data.sleepState ? (() => { const m = Math.floor((now - new Date(data.sleepState.startTime)) / 60000); return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; })() : null;

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
                   log.type === "sleep" ? (log.subtype === "woke_up" ? `Slept ${log.durationMins||0}m` : "Fell asleep") :
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{[...todayFoods].reverse().map(f => (
            <div key={f.id} className="card" style={{ background: theme.card, borderRadius: 14, padding: "12px 14px", border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 14, fontWeight: 700 }}>{f.foodName}{f.reaction === "loved" ? " 😍" : f.reaction === "refused" ? " 🙅" : ""}</div><div style={{ fontSize: 11, color: theme.textMuted }}>{f.servingSize || ""} {f.time ? `\u00B7 ${formatTime12(f.time)}` : ""}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 800, color: theme.accent }}>{f.calories||0} cal</div><div style={{ fontSize: 10, color: theme.textMuted }}>P:{f.protein||0} C:{f.carbs||0} F:{f.fat||0}</div></div>
            </div>
          ))}</div>
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
function FoodLogModal({ theme, addLog, data, updateData, todayStr, now, showToast }) {
  const [fn, setFn] = useState(""); const [ss, setSs] = useState(""); const [cal, setCal] = useState(""); const [pro, setPro] = useState(""); const [carb, setCarb] = useState(""); const [fat, setFat] = useState(""); const [fib, setFib] = useState(""); const [sug, setSug] = useState(""); const [time, setTime] = useState(localTimeStr(now)); const [rx, setRx] = useState("");
  const qf = [{n:"Banana",c:89,p:1,ca:23,f:0,fi:3,s:12,sv:"1 medium"},{n:"Avocado",c:80,p:1,ca:4,f:7,fi:3,s:0,sv:"1/4"},{n:"Sweet Potato",c:86,p:2,ca:20,f:0,fi:3,s:4,sv:"1/2 cup"},{n:"Yogurt",c:60,p:3,ca:7,f:2,fi:0,s:5,sv:"1/4 cup"},{n:"Cheerios",c:70,p:2,ca:14,f:1,fi:2,s:1,sv:"1/2 cup"},{n:"Apple Sauce",c:50,p:0,ca:14,f:0,fi:1,s:11,sv:"1/4 cup"},{n:"Egg",c:70,p:6,ca:0,f:5,fi:0,s:0,sv:"1 egg"},{n:"PB",c:95,p:4,ca:3,f:8,fi:1,s:2,sv:"1 tbsp"},{n:"Rice Cereal",c:60,p:1,ca:13,f:0,fi:0,s:1,sv:"1/4 cup"},{n:"Puffs",c:25,p:0,ca:5,f:0,fi:0,s:0,sv:"7 pcs"}];
  const pick = (f) => { setFn(f.n); setCal(String(f.c)); setPro(String(f.p)); setCarb(String(f.ca)); setFat(String(f.f)); setFib(String(f.fi)); setSug(String(f.s)); setSs(f.sv); };
  const submit = () => { if (!fn) return; addLog({ type: "food", foodName: fn, servingSize: ss, calories: parseFloat(cal)||0, protein: parseFloat(pro)||0, carbs: parseFloat(carb)||0, fat: parseFloat(fat)||0, fiber: parseFloat(fib)||0, sugar: parseFloat(sug)||0, date: todayStr, time, reaction: rx }); const prefs = data.foodPreferences || { likes: [], dislikes: [] }; const k = fn.toLowerCase(); if (rx === "loved" && !prefs.likes.includes(k)) updateData("foodPreferences", { ...prefs, likes: [...prefs.likes, k], dislikes: prefs.dislikes.filter(d => d !== k) }); if (rx === "refused" && !prefs.dislikes.includes(k)) updateData("foodPreferences", { ...prefs, dislikes: [...prefs.dislikes, k], likes: prefs.likes.filter(l => l !== k) }); };
  const is = inputStyle(theme);
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16, textAlign: "center" }}>🍎 Log Food</h2>
      <SectionLabel theme={theme}>Quick Picks</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>{qf.map(f => (<button key={f.n} onClick={() => pick(f)} style={{ background: fn === f.n ? theme.accentSoft : theme.bg, border: `1px solid ${fn === f.n ? theme.accent : theme.border}`, borderRadius: 10, padding: "6px 12px", color: fn === f.n ? theme.accent : theme.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{f.n}</button>))}</div>
      <input placeholder="Food name" value={fn} onChange={e => setFn(e.target.value)} style={{ ...is, fontSize: 16, fontWeight: 700, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><input placeholder="Serving" value={ss} onChange={e => setSs(e.target.value)} style={{ ...is, flex: 1 }} /><input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...is, flex: 1 }} /></div>
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
  const [bc, setBc] = useState(""); const [loading, setLoading] = useState(false); const [product, setProduct] = useState(null); const [err, setErr] = useState(""); const [time, setTime] = useState(localTimeStr(now)); const [rx, setRx] = useState(""); const [servings, setServings] = useState("1");

  const lookup = async () => {
    if (!bc.trim()) return; setLoading(true); setErr(""); setProduct(null);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${bc.trim()}.json`);
      const json = await res.json();
      if (json.status === 1 && json.product) {
        const p = json.product, n = p.nutriments || {};
        setProduct({ name: p.product_name || p.product_name_en || "Unknown", brand: p.brands || "", image: p.image_front_small_url || "", servingSize: p.serving_size || "", calories: Math.round(n["energy-kcal_serving"] || n["energy-kcal_100g"] || 0), protein: Math.round((n.proteins_serving || n.proteins_100g || 0) * 10) / 10, carbs: Math.round((n.carbohydrates_serving || n.carbohydrates_100g || 0) * 10) / 10, fat: Math.round((n.fat_serving || n.fat_100g || 0) * 10) / 10, fiber: Math.round((n.fiber_serving || n.fiber_100g || 0) * 10) / 10, sugar: Math.round((n.sugars_serving || n.sugars_100g || 0) * 10) / 10, nutriscore: p.nutriscore_grade || "" });
      } else setErr("Product not found. Try a different barcode or enter manually.");
    } catch { setErr("Lookup failed. Check connection."); }
    setLoading(false);
  };

  const submit = () => {
    if (!product) return; const m = parseFloat(servings) || 1;
    addLog({ type: "food", foodName: `${product.name}${product.brand ? ` (${product.brand})` : ""}`, servingSize: product.servingSize ? `${m}x ${product.servingSize}` : `${m} serving`, calories: Math.round(product.calories * m), protein: Math.round(product.protein * m * 10) / 10, carbs: Math.round(product.carbs * m * 10) / 10, fat: Math.round(product.fat * m * 10) / 10, fiber: Math.round(product.fiber * m * 10) / 10, sugar: Math.round(product.sugar * m * 10) / 10, date: todayStr, time, reaction: rx, barcode: bc.trim(), source: "barcode" });
    if (rx === "loved" || rx === "refused") { const prefs = data.foodPreferences || { likes: [], dislikes: [] }; const k = product.name.toLowerCase(); if (rx === "loved" && !prefs.likes.includes(k)) updateData("foodPreferences", { ...prefs, likes: [...prefs.likes, k], dislikes: prefs.dislikes.filter(d => d !== k) }); if (rx === "refused" && !prefs.dislikes.includes(k)) updateData("foodPreferences", { ...prefs, dislikes: [...prefs.dislikes, k], likes: prefs.likes.filter(l => l !== k) }); }
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 4, textAlign: "center" }}>📷 Barcode Lookup</h2>
      <p style={{ fontSize: 12, color: theme.textMuted, textAlign: "center", marginBottom: 16 }}>Enter the barcode number from the package</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="e.g. 0016000275638" value={bc} onChange={e => setBc(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} inputMode="numeric" style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 18, fontWeight: 700, textAlign: "center", letterSpacing: 2 }} />
        <button onClick={lookup} disabled={loading || !bc.trim()} style={{ padding: "14px 20px", borderRadius: 14, background: bc.trim() ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 14, border: "none", cursor: bc.trim() ? "pointer" : "default" }}>{loading ? "..." : "Go"}</button>
      </div>
      {loading && <div style={{ textAlign: "center", padding: 30 }}><div style={{ fontSize: 32, animation: "spin 1s linear infinite", display: "inline-block" }}>🔍</div><p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>Searching Open Food Facts...</p></div>}
      {err && <div style={{ background: "rgba(229,115,115,0.12)", borderRadius: 14, padding: 16, textAlign: "center", marginBottom: 16 }}><span style={{ fontSize: 24 }}>😕</span><p style={{ fontSize: 13, color: "#e57373", marginTop: 8 }}>{err}</p></div>}
      {product && (
        <div style={{ animation: "fadeIn 0.25s ease" }}>
          <div style={{ background: theme.card, borderRadius: 20, padding: 16, border: `1px solid ${theme.border}`, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
              {product.image && <img src={product.image} alt="" style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", background: theme.bg }} onError={e => e.target.style.display = "none"} />}
              <div><div style={{ fontSize: 16, fontWeight: 800 }}>{product.name}</div>{product.brand && <div style={{ fontSize: 12, color: theme.textMuted }}>{product.brand}</div>}{product.servingSize && <div style={{ fontSize: 12, color: theme.accent, fontWeight: 600 }}>Serving: {product.servingSize}</div>}{product.nutriscore && <div style={{ fontSize: 11, color: theme.textMuted }}>Nutri-Score: {product.nutriscore.toUpperCase()}</div>}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <MacroBox label="Calories" value={product.calories} unit="kcal" color={theme.accent} theme={theme} /><MacroBox label="Protein" value={product.protein} unit="g" color={theme.info} theme={theme} /><MacroBox label="Carbs" value={product.carbs} unit="g" color={theme.warning} theme={theme} /><MacroBox label="Fat" value={product.fat} unit="g" color={theme.accent} theme={theme} /><MacroBox label="Fiber" value={product.fiber} unit="g" color={theme.success} theme={theme} /><MacroBox label="Sugar" value={product.sugar} unit="g" color={theme.purple} theme={theme} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700 }}>SERVINGS</label><input type="number" step="0.5" min="0.25" value={servings} onChange={e => setServings(e.target.value)} style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px", color: theme.text, fontSize: 16, fontWeight: 700, textAlign: "center", marginTop: 4 }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700 }}>TIME</label><input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px", color: theme.text, fontSize: 14, marginTop: 4 }} /></div>
          </div>
          <SectionLabel theme={theme}>Reaction</SectionLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{[{id:"loved",e:"😍",l:"Loved"},{id:"liked",e:"😊",l:"Liked"},{id:"meh",e:"😐",l:"Meh"},{id:"refused",e:"🙅",l:"Refused"}].map(r => (<button key={r.id} onClick={() => setRx(r.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 12, textAlign: "center", background: rx === r.id ? theme.accentSoft : theme.bg, border: `1px solid ${rx === r.id ? theme.accent : theme.border}`, cursor: "pointer", fontSize: 11, fontWeight: 700, color: rx === r.id ? theme.accent : theme.textMuted }}><span style={{ fontSize: 16, display: "block" }}>{r.e}</span>{r.l}</button>))}</div>
          <button onClick={submit} style={{ width: "100%", padding: 16, borderRadius: 16, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer" }}>Log {product.name}</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OTHER MODALS
// ═══════════════════════════════════════════════════════════════
function BottleModal({ theme, addLog, todayStr, now }) {
  const [amt, setAmt] = useState(""); const [ft, setFt] = useState("formula"); const [time, setTime] = useState(localTimeStr(now));
  return (<div><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>🍼 Log Bottle</h2><div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "center", flexWrap: "wrap" }}>{["formula","breast","milk","water","juice"].map(t => (<button key={t} onClick={() => setFt(t)} style={{ background: ft === t ? theme.accentSoft : theme.bg, border: `1px solid ${ft === t ? theme.accent : theme.border}`, borderRadius: 12, padding: "8px 14px", color: ft === t ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>))}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>{[2,3,4,5,6,7,8].map(a => (<button key={a} onClick={() => setAmt(String(a))} style={{ width: 56, height: 56, borderRadius: 16, fontSize: 18, fontWeight: 800, background: amt === String(a) ? theme.accent : theme.bg, color: amt === String(a) ? "#fff" : theme.text, border: `2px solid ${amt === String(a) ? theme.accent : theme.border}`, cursor: "pointer" }}>{a}</button>))}</div><div style={{ display: "flex", gap: 8, marginBottom: 16 }}><input type="number" step="0.5" placeholder="Custom oz" value={amt} onChange={e => setAmt(e.target.value)} style={{ flex: 1, ...inputStyle(theme), fontSize: 18, fontWeight: 700, textAlign: "center" }} /><input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle(theme)} /></div><button onClick={() => amt && addLog({ type: "bottle", amount: parseFloat(amt), feedType: ft, date: todayStr, time })} disabled={!amt} style={{ width: "100%", padding: 16, borderRadius: 16, background: amt ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: amt ? "pointer" : "default" }}>Log {amt||0} oz {ft}</button></div>);
}
function MedicineModal({ theme, addLog, todayStr, now }) {
  const [n, setN] = useState(""); const [d, setD] = useState(""); const [t, setT] = useState(localTimeStr(now));
  return (<div><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>💊 Medicine</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>{["Tylenol","Ibuprofen","Vitamin D","Gripe Water","Gas Drops","Probiotics"].map(m => (<button key={m} onClick={() => setN(m)} style={{ background: n === m ? theme.accentSoft : theme.bg, border: `1px solid ${n === m ? theme.accent : theme.border}`, borderRadius: 12, padding: "8px 14px", color: n === m ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{m}</button>))}</div><input placeholder="Medicine name" value={n} onChange={e => setN(e.target.value)} style={{ ...inputStyle(theme), fontSize: 16, marginBottom: 10 }} /><div style={{ display: "flex", gap: 8, marginBottom: 16 }}><input placeholder="Dose" value={d} onChange={e => setD(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /><input type="time" value={t} onChange={e => setT(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /></div><button onClick={() => n && addLog({ type: "medicine", name: n, dose: d, date: todayStr, time: t })} disabled={!n} style={{ width: "100%", padding: 16, borderRadius: 16, background: n ? theme.accent : theme.border, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: n ? "pointer" : "default" }}>Log</button></div>);
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
  const [n, setN] = useState(""); const [w, setW] = useState(""); const [h, setH] = useState(""); const [d, setD] = useState(localDateStr());
  return (<div><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>🩺 Doctor Visit</h2><input type="date" value={d} onChange={e => setD(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 10 }} /><div style={{ display: "flex", gap: 8, marginBottom: 10 }}><input placeholder="Weight (lbs)" type="number" step="0.1" value={w} onChange={e => setW(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /><input placeholder="Height (in)" type="number" step="0.1" value={h} onChange={e => setH(e.target.value)} style={{ ...inputStyle(theme), flex: 1 }} /></div><textarea placeholder="Notes, vaccines, concerns..." value={n} onChange={e => setN(e.target.value)} rows={4} style={{ ...inputStyle(theme), resize: "none", marginBottom: 16 }} /><button onClick={() => { updateData("pediatricianNotes", [...(data.pediatricianNotes || []), { id: uid(), date: d, weight: w ? parseFloat(w) : null, height: h ? parseFloat(h) : null, note: n, timestamp: new Date().toISOString() }]); if (w || h) updateData("growthRecords", [...(data.growthRecords || []), { id: uid(), date: d, weight: w ? parseFloat(w) : null, height: h ? parseFloat(h) : null, source: "doctor" }]); showToast("🩺 Saved!"); }} style={{ width: "100%", padding: 16, borderRadius: 16, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer" }}>Save</button></div>);
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
  const [cat, setCat] = useState("motor"); const ms = data.milestones || {};
  const toggle = (c, i) => { const k = `${c}_${i}`; const u = { ...ms }; if (u[k]) delete u[k]; else u[k] = localDateStr(); updateData("milestones", u); if (!ms[k]) showToast("⭐ Milestone!"); };
  const cc = Object.keys(ms).filter(k => k.startsWith(cat)).length, tc = MILESTONE_CATEGORIES[cat].items.length;
  return (<div><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>⭐ Milestones</h2>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>{Object.entries(MILESTONE_CATEGORIES).map(([k, c]) => (<button key={k} className="tab-btn" onClick={() => setCat(k)} style={{ background: cat === k ? theme.accentSoft : theme.card, border: `1px solid ${cat === k ? theme.accent : theme.border}`, borderRadius: 14, padding: "8px 14px", color: cat === k ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>{c.icon} {c.label}</button>))}</div>
    <div style={{ background: theme.card, borderRadius: 16, padding: "12px 16px", border: `1px solid ${theme.border}`, marginBottom: 16 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{MILESTONE_CATEGORIES[cat].label}</span><span style={{ fontSize: 13, fontWeight: 800, color: theme.accent }}>{cc}/{tc}</span></div><div style={{ height: 6, background: theme.bg, borderRadius: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${(cc/tc)*100}%`, background: theme.accent, borderRadius: 6, transition: "width 0.3s" }} /></div></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{MILESTONE_CATEGORIES[cat].items.map(i => { const k = `${cat}_${i}`, done = ms[k]; return (<button key={i} className="card" onClick={() => toggle(cat, i)} style={{ background: done ? theme.accentSoft : theme.card, border: `1px solid ${done ? theme.accent : theme.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}><div style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${done ? theme.accent : theme.border}`, background: done ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 800, flexShrink: 0 }}>{done ? "✓" : ""}</div><div style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 700, color: done ? theme.accent : theme.text }}>{i}</span>{done && <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 8 }}>{done}</span>}</div></button>); })}</div>
  </div>);
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
  </div>);
}

function CoPilotPage({ data, theme, updateData, showToast }) {
  const [digest, setDigest] = useState(""); const [loading, setLoading] = useState(false); const [tab, setTab] = useState("digest");
  const gen = async () => {
    const key = data.settings?.aiKey, prov = data.settings?.aiProvider || "groq";
    if (!key) { showToast("Set AI key in Settings", "error"); return; }
    setLoading(true);
    const l7 = last7Days(), wl = data.logs.filter(l => l7.includes(l.date)), pp = wl.filter(l => l.type === "poop"), fl = wl.filter(l => l.type === "food");
    const sum = { bottles: wl.filter(l=>l.type==="bottle").length, totalOz: wl.filter(l=>l.type==="bottle").reduce((s,l)=>s+(l.amount||0),0), poops: pp.length, poopColors: pp.map(p=>POOP_COLORS.find(c=>c.id===p.color)?.label).filter(Boolean), foods: fl.map(f=>f.foodName).filter(Boolean), totalCal: fl.reduce((s,f)=>s+(f.calories||0),0), sleeps: wl.filter(l=>l.type==="sleep").length, milestones: Object.entries(data.milestones||{}).filter(([_,d])=>l7.includes(d)).map(([k])=>k.split('_').slice(1).join(' ')), likes: (data.foodPreferences?.likes||[]).join(', ') };
    const prompt = `Warm baby care assistant. Write 2-3 paragraph weekly digest for ${data.baby.name||"baby"}'s family from: ${JSON.stringify(sum)}. Include poop/food patterns. Be warm. End with emoji.`;
    let ep, hd, body;
    if (prov === "groq") { ep = "https://api.groq.com/openai/v1/chat/completions"; hd = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; body = { model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 700 }; }
    else if (prov === "openai") { ep = "https://api.openai.com/v1/chat/completions"; hd = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; body = { model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 700 }; }
    else if (prov === "anthropic") { ep = "https://api.anthropic.com/v1/messages"; hd = { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }; body = { model: "claude-sonnet-4-20250514", messages: [{ role: "user", content: prompt }], max_tokens: 700 }; }
    else { ep = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`; hd = { "Content-Type": "application/json" }; body = { contents: [{ parts: [{ text: prompt }] }] }; }
    try { const res = await fetch(ep, { method: "POST", headers: hd, body: JSON.stringify(body) }); const j = await res.json(); let txt = prov === "anthropic" ? j.content?.[0]?.text : prov === "gemini" ? j.candidates?.[0]?.content?.parts?.[0]?.text : j.choices?.[0]?.message?.content; txt = txt || "Error"; setDigest(txt); updateData("familyUpdates", [...(data.familyUpdates||[]), { id: uid(), text: txt, date: localDateStr(), timestamp: new Date().toISOString() }]); } catch { setDigest("Failed. Check API key."); showToast("Failed", "error"); }
    setLoading(false);
  };
  return (<div><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>🤖 AI Co-Pilot</h2>
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{[{id:"digest",l:"Digest"},{id:"insights",l:"Insights"},{id:"history",l:"Past"}].map(t => (<button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{ background: tab === t.id ? theme.accentSoft : theme.card, border: `1px solid ${tab === t.id ? theme.accent : theme.border}`, borderRadius: 14, padding: "8px 14px", color: tab === t.id ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12 }}>{t.l}</button>))}</div>
    {tab === "digest" && (<><button className="log-btn" onClick={gen} disabled={loading} style={{ width: "100%", padding: 20, borderRadius: 20, background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`, color: "#fff", fontWeight: 800, fontSize: 18, border: "none", cursor: "pointer", marginBottom: 16, opacity: loading ? 0.6 : 1 }}>{loading ? "✨ Generating..." : "✨ Generate Digest"}</button>{digest && <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, animation: "fadeIn 0.3s" }}><p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{digest}</p><button onClick={() => { navigator.clipboard?.writeText(digest); showToast("Copied!"); }} style={{ marginTop: 12, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "8px 16px", color: theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📋 Copy</button></div>}<p style={{ fontSize: 12, color: theme.textMuted, textAlign: "center", marginTop: 12 }}>Using: {data.settings?.aiProvider?.toUpperCase()||"GROQ"} {data.settings?.aiProvider !== "groq" && "💲"}</p></>)}
    {tab === "insights" && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}><h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: theme.warning }}>💩 Poop Health</h3><p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6 }}>{(()=>{ const pp = data.logs.filter(l=>l.type==="poop"); if (pp.length < 3) return "Log more poops for insights!"; const a = pp.filter(p=>POOP_COLORS.find(c=>c.id===p.color)?.status==="alert").length; return a > 0 ? `${a} flagged. Check Poop Patterns.` : "All recent poops look healthy!"; })()}</p></div><div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}><h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: theme.success }}>🍎 Nutrition</h3><p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6 }}>{data.logs.filter(l=>l.type==="food").length > 3 ? `${(data.foodPreferences?.likes||[]).length} favorite foods. ${(data.foodPreferences?.dislikes||[]).length} dislikes tracked.` : "Log more foods for insights!"}</p></div></div>}
    {tab === "history" && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{(data.familyUpdates||[]).length === 0 ? <p style={{ color: theme.textMuted, textAlign: "center", padding: 30 }}>No digests yet.</p> : [...(data.familyUpdates||[])].reverse().map(u => (<div key={u.id} style={{ background: theme.card, borderRadius: 16, padding: 16, border: `1px solid ${theme.border}` }}><p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>{u.date}</p><p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{u.text}</p></div>))}</div>}
  </div>);
}

function SettingsPage({ data, updateData, theme, showToast, navigate }) {
  const s = data.settings || {}, b = data.baby || DEFAULT_BABY;
  const us = (k, v) => updateData("settings", { ...s, [k]: v }), ub = (k, v) => updateData("baby", { ...b, [k]: v });
  return (<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>⚙️ Settings</h2>
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}><SectionLabel theme={theme}>Baby Profile</SectionLabel><input placeholder="Name" value={b.name === "Baby" ? "" : b.name} onChange={e => ub("name", e.target.value || "Baby")} style={{ ...inputStyle(theme), fontSize: 16, marginBottom: 10 }} /><label style={{ fontSize: 12, color: theme.textMuted, display: "block", marginBottom: 4 }}>Birth Date</label><input type="date" value={b.birthDate} onChange={e => ub("birthDate", e.target.value)} style={inputStyle(theme)} />{b.birthDate && <p style={{ fontSize: 13, color: theme.accent, marginTop: 8, fontWeight: 700 }}>{ageString(b.birthDate)}</p>}</div>
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}><SectionLabel theme={theme}>Theme</SectionLabel><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{Object.entries(THEMES).map(([k, t]) => (<button key={k} className="card" onClick={() => us("theme", k)} style={{ background: t.bg, border: `2px solid ${s.theme === k ? t.accent : t.border}`, borderRadius: 16, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 24, height: 24, borderRadius: 8, background: t.accent }} /><span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{t.name}</span>{s.theme === k && <span>✓</span>}</button>))}</div></div>
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}><SectionLabel theme={theme}>AI Provider (BYOK)</SectionLabel><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>{[{id:"groq",l:"Groq (Free)"},{id:"openai",l:"💲 OpenAI"},{id:"anthropic",l:"💲 Claude"},{id:"gemini",l:"💲 Gemini"}].map(p => (<button key={p.id} className="card" onClick={() => us("aiProvider", p.id)} style={{ background: s.aiProvider === p.id ? theme.accentSoft : theme.bg, border: `1px solid ${s.aiProvider === p.id ? theme.accent : theme.border}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", color: s.aiProvider === p.id ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12 }}>{p.l}</button>))}</div><input type="password" placeholder="API Key" value={s.aiKey || ""} onChange={e => us("aiKey", e.target.value)} style={inputStyle(theme)} /><p style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>{s.aiProvider === "groq" ? "Free at console.groq.com/keys" : "Paid API key required."}</p></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{[{p:"growth",i:"📏",l:"Growth"},{p:"activities",i:"🎯",l:"Activities"},{p:"pooplog",i:"💩",l:"Poop Log"},{p:"family",i:"👨‍👩‍👦",l:"Family"}].map(x => (<button key={x.p} className="log-btn" onClick={() => navigate(x.p)} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 16, cursor: "pointer", textAlign: "center" }}><span style={{ fontSize: 22 }}>{x.i}</span><div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{x.l}</div></button>))}</div>
    <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}><SectionLabel theme={theme}>Data</SectionLabel><div style={{ display: "flex", gap: 10 }}><button onClick={() => { const bl = new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const u = URL.createObjectURL(bl); const a = document.createElement("a"); a.href = u; a.download = `wieser-baby-${localDateStr()}.json`; a.click(); URL.revokeObjectURL(u); showToast("Downloaded!"); }} style={{ flex: 1, padding: 14, borderRadius: 14, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📦 Export</button><button onClick={() => { if (window.confirm("Clear ALL data?")) { updateData("logs",[]); updateData("milestones",{}); updateData("growthRecords",[]); updateData("familyUpdates",[]); updateData("pediatricianNotes",[]); updateData("foodPreferences",{likes:[],dislikes:[]}); showToast("Cleared"); } }} style={{ flex: 1, padding: 14, borderRadius: 14, background: "rgba(229,115,115,0.1)", border: "1px solid rgba(229,115,115,0.3)", color: "#e57373", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🗑️ Clear</button></div></div>
    <div style={{ textAlign: "center", padding: 20, color: theme.textMuted }}><p style={{ fontFamily: "'Fredoka'", fontSize: 16 }}><span style={{ color: theme.accent }}>Wieser</span> Baby</p><p style={{ fontSize: 12, marginTop: 4 }}>v{APP_VERSION}</p></div>
  </div>);
}

function HistoryPage({ data, theme, updateData, navigateBack, showToast }) {
  const [fd, setFd] = useState(localDateStr()); const [ft, setFt] = useState("all");
  const logs = data.logs.filter(l => l.date === fd && (ft === "all" || l.type === ft));
  return (<div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}><button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button><h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>📅 History</h2></div>
    <input type="date" value={fd} onChange={e => setFd(e.target.value)} style={{ ...inputStyle(theme), marginBottom: 10 }} />
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>{["all","bottle","poop","diaper","sleep","food","medicine","note"].map(t => (<button key={t} className="tab-btn" onClick={() => setFt(t)} style={{ background: ft === t ? theme.accentSoft : theme.card, border: `1px solid ${ft === t ? theme.accent : theme.border}`, borderRadius: 10, padding: "6px 12px", color: ft === t ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 11, textTransform: "capitalize" }}>{t}</button>))}</div>
    {logs.length === 0 ? <p style={{ color: theme.textMuted, textAlign: "center", padding: 30 }}>No logs.</p> : logs.map(l => (
      <div key={l.id} style={{ background: theme.card, borderRadius: 14, padding: "12px 16px", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{logIcon(l.type)}</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{l.type === "bottle" ? `${l.amount} oz ${l.feedType||""}` : l.type === "poop" ? `${POOP_COLORS.find(c=>c.id===l.color)?.label||""} / ${POOP_CONSISTENCIES.find(c=>c.id===l.consistency)?.label||""}` : l.type === "diaper" ? "Wet" : l.type === "sleep" ? (l.subtype === "woke_up" ? `Slept ${l.durationMins}m` : "Asleep") : l.type === "food" ? `${l.foodName||""} (${l.calories||0}cal)` : l.type === "medicine" ? `${l.name} ${l.dose||""}` : l.note?.slice(0,40)||"Note"}</div><div style={{ fontSize: 11, color: theme.textMuted }}>{formatTime12(l.time)}</div></div>
        <button onClick={() => { if (window.confirm("Delete?")) { updateData("logs", data.logs.filter(x => x.id !== l.id)); showToast("Deleted"); } }} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: theme.textMuted }}>✕</button>
      </div>
    ))}
  </div>);
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
