import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";

// ─── Constants & Config ───────────────────────────────────────
const APP_VERSION = "1.0.0";
const STORAGE_KEY = "wieser-baby-data";
const THEMES = {
  midnight: { bg: "#07080d", card: "#12141c", cardHover: "#1a1d28", border: "#1e2130", accent: "#f4845f", accentSoft: "rgba(244,132,95,0.15)", text: "#e8e6e3", textMuted: "#7a7d8c", success: "#88d8b0", warning: "#f6ae2d", info: "#7eb8da", purple: "#b8a9c9", name: "Midnight" },
  ocean: { bg: "#060d14", card: "#0c1a28", cardHover: "#122234", border: "#1a2e42", accent: "#4fc3f7", accentSoft: "rgba(79,195,247,0.15)", text: "#dce8f0", textMuted: "#5a7a90", success: "#81c784", warning: "#ffb74d", info: "#64b5f6", purple: "#ab99c7", name: "Ocean" },
  blossom: { bg: "#faf5f2", card: "#ffffff", cardHover: "#fef7f4", border: "#f0e4de", accent: "#e8766a", accentSoft: "rgba(232,118,106,0.12)", text: "#2d2420", textMuted: "#8a7e78", success: "#6dbd8a", warning: "#e8a84c", info: "#6ba3c4", purple: "#a18dbf", name: "Blossom" },
  forest: { bg: "#080d08", card: "#111a11", cardHover: "#182218", border: "#1e2e1e", accent: "#8bc34a", accentSoft: "rgba(139,195,74,0.15)", text: "#dce8dc", textMuted: "#5a7a5a", success: "#a5d6a7", warning: "#dce775", info: "#80cbc4", purple: "#b39ddb", name: "Forest" },
};

const NAV_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "Home" },
  { id: "trends", icon: "📊", label: "Trends" },
  { id: "milestones", icon: "⭐", label: "Milestones" },
  { id: "growth", icon: "📏", label: "Growth" },
  { id: "copilot", icon: "🤖", label: "AI" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

const MILESTONE_CATEGORIES = {
  motor: { label: "Motor Skills", icon: "🏃", items: ["Holds head up","Rolls over","Sits unassisted","Crawls","Pulls to stand","Cruises furniture","First steps","Walks independently","Runs","Climbs stairs","Jumps with both feet","Pedals tricycle","Catches a ball","Hops on one foot"] },
  speech: { label: "Speech & Language", icon: "🗣️", items: ["First coo","Babbles","Responds to name","Says mama/dada","First word","2-word phrases","50+ words","Short sentences","Asks why","Tells a story","Knows colors","Counts to 10","Sings songs"] },
  social: { label: "Social & Emotional", icon: "💛", items: ["Social smile","Laughs out loud","Stranger anxiety","Waves bye-bye","Plays peekaboo","Shows affection","Parallel play","Shares toys","Takes turns","Makes friends","Shows empathy","Follows rules"] },
  cognitive: { label: "Cognitive", icon: "🧠", items: ["Tracks objects","Reaches for toys","Object permanence","Stacks blocks","Simple puzzles","Sorts shapes","Pretend play","Matches colors","Draws a circle","Writes name","Recognizes letters","Counts objects"] },
  selfcare: { label: "Self-Care", icon: "🪥", items: ["Holds bottle","Finger foods","Drinks from cup","Uses spoon","Uses fork","Potty training starts","Daytime dry","Nighttime dry","Brushes teeth","Dresses self","Ties shoes","Buttons clothes"] },
};

const DEFAULT_BABY = { name: "Baby", birthDate: "", photo: "" };

// ─── Helpers ──────────────────────────────────────────────────
const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const localTimeStr = (d = new Date()) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const formatTime12 = (t) => { const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };
const daysOld = (birthDate) => { if (!birthDate) return null; const diff = Date.now() - new Date(birthDate).getTime(); return Math.floor(diff / 86400000); };
const ageString = (birthDate) => {
  if (!birthDate) return "";
  const days = daysOld(birthDate);
  if (days < 0) return "Not born yet";
  const years = Math.floor(days / 365.25);
  const months = Math.floor((days % 365.25) / 30.44);
  const d = Math.floor(days % 30.44);
  if (years > 0) return `${years}y ${months}m`;
  if (months > 0) return `${months}m ${d}d`;
  return `${d} day${d !== 1 ? 's' : ''} old`;
};
const last7Days = () => Array.from({length: 7}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return localDateStr(d); });
const dayLabel = (ds) => { const d = new Date(ds + 'T12:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short' }); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ─── Storage ──────────────────────────────────────────────────
const loadData = async () => {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
};
const saveData = async (data) => {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.error("Save failed:", e); }
};

const DEFAULT_DATA = {
  baby: { ...DEFAULT_BABY },
  logs: [],
  milestones: {},
  growthRecords: [],
  settings: { theme: "midnight", aiProvider: "groq", aiKey: "", familyMembers: [], notifyOnDigest: false },
  familyUpdates: [],
  sleepState: null,
  pediatricianNotes: [],
  activities: [],
  medications: [],
};

// ─── Main App ─────────────────────────────────────────────────
export default function WieserBabyApp() {
  const [page, setPage] = useState("dashboard");
  const [pageHistory, setPageHistory] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(new Date());

  const theme = data?.settings?.theme ? THEMES[data.settings.theme] : THEMES.midnight;

  // Clock tick
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);

  // Load data
  useEffect(() => { (async () => { const d = await loadData(); setData(d || { ...DEFAULT_DATA }); setLoading(false); })(); }, []);

  // Save on change
  useEffect(() => { if (data && !loading) saveData(data); }, [data, loading]);

  // Navigation with history
  const navigate = useCallback((p) => { setPageHistory(h => [...h, page]); setPage(p); }, [page]);
  const navigateBack = useCallback(() => { setPageHistory(h => { const n = [...h]; const prev = n.pop() || "dashboard"; setPage(prev); return n; }); }, []);

  // Browser back button
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); navigateBack(); };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [navigateBack]);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const addLog = (log) => {
    setData(d => ({ ...d, logs: [...d.logs, { ...log, id: uid(), timestamp: new Date().toISOString() }] }));
    showToast(`${log.type === 'bottle' ? '🍼' : log.type === 'diaper' ? '💩' : log.type === 'sleep' ? '😴' : log.type === 'medicine' ? '💊' : '📝'} Logged!`);
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

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overscroll-behavior: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes ripple { to { transform: scale(2.5); opacity: 0; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes toastIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        input, select, textarea { font-family: 'Nunito', sans-serif; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${theme.accent}; outline-offset: -2px; }
        ::-webkit-scrollbar { width: 0; }
        .log-btn { transition: transform 0.12s ease, box-shadow 0.12s ease; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
        .log-btn:active { transform: scale(0.94) !important; }
        .log-btn:hover { transform: scale(1.03); }
        .card { transition: background 0.15s ease; }
        .card:hover { background: ${theme.cardHover} !important; }
        .nav-btn { transition: all 0.15s ease; }
        .nav-btn:active { transform: scale(0.9); }
        .tab-btn { transition: all 0.15s ease; cursor: pointer; }
        .tab-btn:active { transform: scale(0.95); }
      `}</style>
      <div style={{
        fontFamily: "'Nunito', sans-serif",
        background: theme.bg,
        color: theme.text,
        minHeight: "100vh",
        maxWidth: 480,
        margin: "0 auto",
        position: "relative",
        paddingBottom: 90,
      }}>
        {/* Header */}
        <header style={{
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: `linear-gradient(${theme.bg}, ${theme.bg}ee)`,
          backdropFilter: "blur(12px)",
        }}>
          <div>
            <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              <span style={{ color: theme.accent }}>Wieser</span> Baby
            </h1>
            {data.baby.name !== "Baby" && (
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                {data.baby.name} {data.baby.birthDate ? `· ${ageString(data.baby.birthDate)}` : ""}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {data.sleepState && (
              <div style={{
                background: theme.accentSoft,
                color: theme.accent,
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
                animation: "pulse 2s ease-in-out infinite",
              }}>
                😴 Sleeping
              </div>
            )}
            <div style={{
              fontSize: 11,
              color: theme.textMuted,
              background: theme.card,
              padding: "4px 10px",
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
            }}>
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ padding: "0 16px 16px", animation: "fadeIn 0.25s ease" }}>
          {page === "dashboard" && <DashboardPage data={data} todayLogs={todayLogs} todayStr={todayStr} theme={theme} setModal={setModal} addLog={addLog} updateData={updateData} now={now} navigate={navigate} showToast={showToast} />}
          {page === "trends" && <TrendsPage data={data} theme={theme} todayStr={todayStr} />}
          {page === "milestones" && <MilestonesPage data={data} updateData={updateData} theme={theme} showToast={showToast} />}
          {page === "growth" && <GrowthPage data={data} updateData={updateData} theme={theme} setModal={setModal} showToast={showToast} />}
          {page === "copilot" && <CoPilotPage data={data} theme={theme} updateData={updateData} showToast={showToast} />}
          {page === "settings" && <SettingsPage data={data} updateData={updateData} theme={theme} showToast={showToast} />}
          {page === "history" && <HistoryPage data={data} theme={theme} updateData={updateData} navigateBack={navigateBack} showToast={showToast} />}
          {page === "activities" && <ActivitiesPage data={data} theme={theme} navigateBack={navigateBack} />}
          {page === "family" && <FamilyPage data={data} updateData={updateData} theme={theme} navigateBack={navigateBack} showToast={showToast} />}
        </main>

        {/* Bottom Nav */}
        <nav style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 480,
          background: `${theme.card}f5`,
          backdropFilter: "blur(16px)",
          borderTop: `1px solid ${theme.border}`,
          display: "flex",
          justifyContent: "space-around",
          padding: `8px 4px calc(8px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 100,
        }}>
          {NAV_ITEMS.map(n => (
            <button key={n.id} className="nav-btn" onClick={() => { setPageHistory([]); setPage(n.id); }} style={{
              background: page === n.id ? theme.accentSoft : "transparent",
              border: "none",
              borderRadius: 14,
              padding: "6px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              minWidth: 52,
            }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: page === n.id ? theme.accent : theme.textMuted }}>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* Modal */}
        {modal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200,
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }} onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
            <div style={{
              background: theme.card,
              borderRadius: "24px 24px 0 0",
              width: "100%",
              maxWidth: 480,
              maxHeight: "85vh",
              overflow: "auto",
              animation: "slideUp 0.25s ease",
              padding: "24px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
            }}>
              {modal}
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "success" ? theme.success : toast.type === "error" ? "#e57373" : theme.warning,
            color: "#000",
            padding: "10px 24px",
            borderRadius: 30,
            fontWeight: 700,
            fontSize: 14,
            zIndex: 300,
            animation: "toastIn 0.2s ease",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
function DashboardPage({ data, todayLogs, todayStr, theme, setModal, addLog, updateData, now, navigate, showToast }) {
  const bottles = todayLogs.filter(l => l.type === "bottle");
  const diapers = todayLogs.filter(l => l.type === "diaper");
  const sleeps = todayLogs.filter(l => l.type === "sleep");
  const totalOz = bottles.reduce((s, b) => s + (b.amount || 0), 0);
  const wetCount = diapers.filter(d => d.subtype === "wet" || d.subtype === "both").length;
  const dirtyCount = diapers.filter(d => d.subtype === "dirty" || d.subtype === "both").length;

  const lastBottle = bottles.length > 0 ? bottles[bottles.length - 1] : null;
  const timeSinceBottle = lastBottle ? (() => {
    const ts = new Date(lastBottle.timestamp);
    const mins = Math.floor((now - ts) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins/60)}h ${mins%60}m ago`;
  })() : null;

  const handleSleepToggle = () => {
    if (data.sleepState) {
      const start = new Date(data.sleepState.startTime);
      const mins = Math.floor((now - start) / 60000);
      addLog({ type: "sleep", subtype: "woke_up", date: todayStr, time: localTimeStr(now), durationMins: mins, sleepStart: data.sleepState.startTime });
      updateData("sleepState", null);
    } else {
      updateData("sleepState", { startTime: now.toISOString() });
      showToast("😴 Sleep timer started");
    }
  };

  const sleepDuration = data.sleepState ? (() => {
    const mins = Math.floor((now - new Date(data.sleepState.startTime)) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })() : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Quick Log Buttons - The Hero Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <QuickLogButton icon="🍼" label="Bottle" sublabel={totalOz > 0 ? `${totalOz} oz today` : null} color={theme.info} theme={theme}
          onClick={() => setModal(<BottleModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
        <QuickLogButton icon="😴" label={data.sleepState ? "Wake Up" : "Sleep"} sublabel={sleepDuration} color={theme.purple} theme={theme}
          onClick={handleSleepToggle} active={!!data.sleepState} />
        <QuickLogButton icon="💩" label="Diaper" sublabel={diapers.length > 0 ? `${diapers.length} today` : null} color={theme.warning} theme={theme}
          onClick={() => setModal(<DiaperModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
        <QuickLogButton icon="💊" label="Medicine" sublabel={null} color={theme.success} theme={theme}
          onClick={() => setModal(<MedicineModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
      </div>

      {/* Today's Summary */}
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Today's Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <SummaryBubble icon="🍼" value={`${totalOz}`} unit="oz" sub={timeSinceBottle || "none yet"} color={theme.info} theme={theme} />
          <SummaryBubble icon="💧" value={`${wetCount}`} unit="wet" sub={`${dirtyCount} dirty`} color={theme.warning} theme={theme} />
          <SummaryBubble icon="😴" value={`${sleeps.length}`} unit="naps" sub={data.sleepState ? "sleeping now" : "awake"} color={theme.purple} theme={theme} />
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <QuickAction icon="📝" label="Note" theme={theme} onClick={() => setModal(<NoteModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
        <QuickAction icon="📅" label="History" theme={theme} onClick={() => navigate("history")} />
        <QuickAction icon="🎯" label="Activities" theme={theme} onClick={() => navigate("activities")} />
        <QuickAction icon="👨‍👩‍👦" label="Family" theme={theme} onClick={() => navigate("family")} />
        <QuickAction icon="🩺" label="Doctor" theme={theme} onClick={() => setModal(<DoctorModal theme={theme} data={data} updateData={updateData} showToast={showToast} />)} />
        <QuickAction icon="🦷" label="Teething" theme={theme} onClick={() => setModal(<TeethingModal theme={theme} addLog={addLog} todayStr={todayStr} now={now} />)} />
      </div>

      {/* Recent Activity Feed */}
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Recent Activity</h3>
        {todayLogs.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", padding: 20 }}>No logs yet today. Tap a button above to start tracking!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...todayLogs].reverse().slice(0, 8).map(log => (
              <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 20 }}>{log.type === "bottle" ? "🍼" : log.type === "diaper" ? "💩" : log.type === "sleep" ? "😴" : log.type === "medicine" ? "💊" : log.type === "teething" ? "🦷" : "📝"}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {log.type === "bottle" ? `${log.amount} oz ${log.feedType || ""}` : log.type === "diaper" ? log.subtype : log.type === "sleep" ? (log.subtype === "woke_up" ? `Slept ${log.durationMins || 0}m` : "Fell asleep") : log.type === "medicine" ? log.name : log.type === "teething" ? `Teething - ${log.tooth || ""}` : log.note?.slice(0, 30) || "Note"}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: theme.textMuted }}>{log.time ? formatTime12(log.time) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick Log Button Component ───────────────────────────────
function QuickLogButton({ icon, label, sublabel, color, theme, onClick, active }) {
  return (
    <button className="log-btn" onClick={onClick} style={{
      background: active ? `${color}30` : theme.card,
      border: `2px solid ${active ? color : theme.border}`,
      borderRadius: 22,
      padding: "20px 12px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      cursor: "pointer",
      minHeight: 110,
      justifyContent: "center",
      boxShadow: active ? `0 0 20px ${color}30` : "none",
    }}>
      <span style={{ fontSize: 36 }}>{icon}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{label}</span>
      {sublabel && <span style={{ fontSize: 12, color, fontWeight: 700 }}>{sublabel}</span>}
    </button>
  );
}

function SummaryBubble({ icon, value, unit, sub, color, theme }) {
  return (
    <div style={{ textAlign: "center" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'Fredoka', sans-serif", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" }}>{unit}</div>
      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function QuickAction({ icon, label, theme, onClick }) {
  return (
    <button className="log-btn" onClick={onClick} style={{
      background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16,
      padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer",
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>{label}</span>
    </button>
  );
}

// ─── Modals ───────────────────────────────────────────────────
function BottleModal({ theme, addLog, todayStr, now }) {
  const [amount, setAmount] = useState("");
  const [feedType, setFeedType] = useState("formula");
  const [time, setTime] = useState(localTimeStr(now));
  const quickAmounts = [2, 3, 4, 5, 6, 7, 8];
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>🍼 Log Bottle</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "center" }}>
        {["formula", "breast", "milk", "water", "juice"].map(t => (
          <button key={t} onClick={() => setFeedType(t)} style={{
            background: feedType === t ? theme.accentSoft : theme.bg, border: `1px solid ${feedType === t ? theme.accent : theme.border}`,
            borderRadius: 12, padding: "8px 14px", color: feedType === t ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
        {quickAmounts.map(a => (
          <button key={a} onClick={() => setAmount(String(a))} style={{
            width: 56, height: 56, borderRadius: 16, fontSize: 18, fontWeight: 800,
            background: amount === String(a) ? theme.accent : theme.bg, color: amount === String(a) ? "#fff" : theme.text,
            border: `2px solid ${amount === String(a) ? theme.accent : theme.border}`, cursor: "pointer",
          }}>{a}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input type="number" step="0.5" placeholder="Custom oz" value={amount} onChange={e => setAmount(e.target.value)}
          style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 18, fontWeight: 700, textAlign: "center" }} />
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 14 }} />
      </div>
      <button onClick={() => amount && addLog({ type: "bottle", amount: parseFloat(amount), feedType, date: todayStr, time })}
        disabled={!amount} style={{
          width: "100%", padding: 16, borderRadius: 16, background: amount ? theme.accent : theme.border,
          color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: amount ? "pointer" : "default", opacity: amount ? 1 : 0.5,
        }}>
        Log {amount || "0"} oz {feedType}
      </button>
    </div>
  );
}

function DiaperModal({ theme, addLog, todayStr, now }) {
  const [time, setTime] = useState(localTimeStr(now));
  const types = [
    { id: "wet", icon: "💧", label: "Wet" },
    { id: "dirty", icon: "💩", label: "Dirty" },
    { id: "both", icon: "💧💩", label: "Both" },
    { id: "dry", icon: "✨", label: "Dry" },
  ];
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>💩 Log Diaper</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {types.map(t => (
          <button key={t.id} className="log-btn" onClick={() => addLog({ type: "diaper", subtype: t.id, date: todayStr, time })}
            style={{
              background: theme.bg, border: `2px solid ${theme.border}`, borderRadius: 18,
              padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer",
            }}>
            <span style={{ fontSize: 32 }}>{t.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{t.label}</span>
          </button>
        ))}
      </div>
      <input type="time" value={time} onChange={e => setTime(e.target.value)}
        style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14, textAlign: "center" }} />
    </div>
  );
}

function MedicineModal({ theme, addLog, todayStr, now }) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState(localTimeStr(now));
  const quickMeds = ["Tylenol", "Ibuprofen", "Vitamin D", "Gripe Water", "Gas Drops", "Probiotics"];
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>💊 Log Medicine</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
        {quickMeds.map(m => (
          <button key={m} onClick={() => setName(m)} style={{
            background: name === m ? theme.accentSoft : theme.bg, border: `1px solid ${name === m ? theme.accent : theme.border}`,
            borderRadius: 12, padding: "8px 14px", color: name === m ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>{m}</button>
        ))}
      </div>
      <input placeholder="Medicine name" value={name} onChange={e => setName(e.target.value)}
        style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 16, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="Dose (e.g. 2.5 mL)" value={dose} onChange={e => setDose(e.target.value)}
          style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 14 }} />
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 14 }} />
      </div>
      <button onClick={() => name && addLog({ type: "medicine", name, dose, date: todayStr, time })}
        disabled={!name} style={{
          width: "100%", padding: 16, borderRadius: 16, background: name ? theme.accent : theme.border,
          color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: name ? "pointer" : "default",
        }}>Log Medicine</button>
    </div>
  );
}

function NoteModal({ theme, addLog, todayStr, now }) {
  const [note, setNote] = useState("");
  const [time, setTime] = useState(localTimeStr(now));
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>📝 Quick Note</h2>
      <textarea placeholder="What's happening?" value={note} onChange={e => setNote(e.target.value)} rows={4}
        style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 16, resize: "none", marginBottom: 10 }} />
      <input type="time" value={time} onChange={e => setTime(e.target.value)}
        style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14, marginBottom: 16, textAlign: "center" }} />
      <button onClick={() => note && addLog({ type: "note", note, date: todayStr, time })}
        disabled={!note} style={{
          width: "100%", padding: 16, borderRadius: 16, background: note ? theme.accent : theme.border,
          color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: note ? "pointer" : "default",
        }}>Save Note</button>
    </div>
  );
}

function TeethingModal({ theme, addLog, todayStr, now }) {
  const teeth = ["Bottom center left", "Bottom center right", "Top center left", "Top center right", "Bottom lateral left", "Bottom lateral right", "Top lateral left", "Top lateral right", "First molar", "Canine", "Second molar"];
  const [tooth, setTooth] = useState("");
  const [symptoms, setSymptoms] = useState("");
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>🦷 Teething Log</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
        {teeth.map(t => (
          <button key={t} onClick={() => setTooth(t)} style={{
            background: tooth === t ? theme.accentSoft : theme.bg, border: `1px solid ${tooth === t ? theme.accent : theme.border}`,
            borderRadius: 12, padding: "6px 12px", color: tooth === t ? theme.accent : theme.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}>{t}</button>
        ))}
      </div>
      <input placeholder="Symptoms (optional)" value={symptoms} onChange={e => setSymptoms(e.target.value)}
        style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 14, marginBottom: 16 }} />
      <button onClick={() => tooth && addLog({ type: "teething", tooth, symptoms, date: todayStr, time: localTimeStr(now) })}
        disabled={!tooth} style={{
          width: "100%", padding: 16, borderRadius: 16, background: tooth ? theme.accent : theme.border,
          color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: tooth ? "pointer" : "default",
        }}>Log Tooth</button>
    </div>
  );
}

function DoctorModal({ theme, data, updateData, showToast }) {
  const [note, setNote] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [date, setDate] = useState(localDateStr());
  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 20, textAlign: "center" }}>🩺 Doctor Visit</h2>
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input placeholder="Weight (lbs)" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)}
          style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14 }} />
        <input placeholder="Height (in)" type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)}
          style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14 }} />
      </div>
      <textarea placeholder="Doctor's notes, vaccines, concerns..." value={note} onChange={e => setNote(e.target.value)} rows={4}
        style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "14px 16px", color: theme.text, fontSize: 14, resize: "none", marginBottom: 16 }} />
      <button onClick={() => {
        const visit = { id: uid(), date, weight: weight ? parseFloat(weight) : null, height: height ? parseFloat(height) : null, note, timestamp: new Date().toISOString() };
        updateData("pediatricianNotes", [...(data.pediatricianNotes || []), visit]);
        if (weight || height) {
          const gr = { id: uid(), date, weight: weight ? parseFloat(weight) : null, height: height ? parseFloat(height) : null, source: "doctor" };
          updateData("growthRecords", [...(data.growthRecords || []), gr]);
        }
        showToast("🩺 Visit saved!");
      }} style={{
        width: "100%", padding: 16, borderRadius: 16, background: theme.accent,
        color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer",
      }}>Save Visit</button>
    </div>
  );
}

// ─── TRENDS PAGE ──────────────────────────────────────────────
function TrendsPage({ data, theme, todayStr }) {
  const days = last7Days();
  const feedingData = days.map(d => {
    const dayLogs = data.logs.filter(l => l.date === d && l.type === "bottle");
    return { day: dayLabel(d), oz: dayLogs.reduce((s, l) => s + (l.amount || 0), 0) };
  });
  const diaperData = days.map(d => {
    const dayLogs = data.logs.filter(l => l.date === d && l.type === "diaper");
    return { day: dayLabel(d), wet: dayLogs.filter(l => l.subtype === "wet" || l.subtype === "both").length, dirty: dayLogs.filter(l => l.subtype === "dirty" || l.subtype === "both").length };
  });
  const sleepData = days.map(d => {
    const dayLogs = data.logs.filter(l => l.date === d && l.type === "sleep" && l.durationMins);
    const totalMins = dayLogs.reduce((s, l) => s + (l.durationMins || 0), 0);
    return { day: dayLabel(d), hours: +(totalMins / 60).toFixed(1) };
  });

  const chartStyle = { background: theme.card, borderRadius: 20, padding: "16px 8px 8px 0", border: `1px solid ${theme.border}`, marginBottom: 16 };

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>📊 7-Day Trends</h2>

      <div style={chartStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingLeft: 16, marginBottom: 8 }}>Feeding (oz/day)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={feedingData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
            <XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} />
            <YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={30} />
            <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.text }} />
            <Bar dataKey="oz" fill={theme.info} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={chartStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingLeft: 16, marginBottom: 8 }}>Diapers</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={diaperData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
            <XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} />
            <YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={30} />
            <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.text }} />
            <Bar dataKey="wet" fill={theme.info} radius={[6, 6, 0, 0]} name="Wet" stackId="a" />
            <Bar dataKey="dirty" fill={theme.warning} radius={[6, 6, 0, 0]} name="Dirty" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={chartStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingLeft: 16, marginBottom: 8 }}>Sleep (hours)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={sleepData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
            <XAxis dataKey="day" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} />
            <YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={30} />
            <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.text }} />
            <Area type="monotone" dataKey="hours" stroke={theme.purple} fill={`${theme.purple}40`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly stats */}
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Weekly Averages</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: theme.info, fontFamily: "'Fredoka', sans-serif" }}>{(feedingData.reduce((s,d) => s + d.oz, 0) / 7).toFixed(1)}</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>oz/day avg</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: theme.warning, fontFamily: "'Fredoka', sans-serif" }}>{(diaperData.reduce((s,d) => s + d.wet + d.dirty, 0) / 7).toFixed(1)}</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>diapers/day</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: theme.purple, fontFamily: "'Fredoka', sans-serif" }}>{(sleepData.reduce((s,d) => s + d.hours, 0) / 7).toFixed(1)}</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>hrs sleep/day</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MILESTONES PAGE ──────────────────────────────────────────
function MilestonesPage({ data, updateData, theme, showToast }) {
  const [activeCat, setActiveCat] = useState("motor");
  const milestones = data.milestones || {};
  const toggleMilestone = (cat, item) => {
    const key = `${cat}_${item}`;
    const updated = { ...milestones };
    if (updated[key]) { delete updated[key]; } else { updated[key] = localDateStr(); }
    updateData("milestones", updated);
    if (!milestones[key]) showToast(`⭐ Milestone achieved!`);
  };
  const completedCount = Object.keys(milestones).filter(k => k.startsWith(activeCat)).length;
  const totalCount = MILESTONE_CATEGORIES[activeCat].items.length;

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>⭐ Milestones</h2>
      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
        {Object.entries(MILESTONE_CATEGORIES).map(([key, cat]) => (
          <button key={key} className="tab-btn" onClick={() => setActiveCat(key)} style={{
            background: activeCat === key ? theme.accentSoft : theme.card, border: `1px solid ${activeCat === key ? theme.accent : theme.border}`,
            borderRadius: 14, padding: "8px 14px", color: activeCat === key ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0,
          }}>{cat.icon} {cat.label}</button>
        ))}
      </div>
      {/* Progress */}
      <div style={{ background: theme.card, borderRadius: 16, padding: "12px 16px", border: `1px solid ${theme.border}`, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{MILESTONE_CATEGORIES[activeCat].label}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: theme.accent }}>{completedCount}/{totalCount}</span>
        </div>
        <div style={{ height: 6, background: theme.bg, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(completedCount/totalCount)*100}%`, background: theme.accent, borderRadius: 6, transition: "width 0.3s ease" }} />
        </div>
      </div>
      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {MILESTONE_CATEGORIES[activeCat].items.map(item => {
          const key = `${activeCat}_${item}`;
          const done = milestones[key];
          return (
            <button key={item} className="card" onClick={() => toggleMilestone(activeCat, item)} style={{
              background: done ? theme.accentSoft : theme.card, border: `1px solid ${done ? theme.accent : theme.border}`,
              borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, border: `2px solid ${done ? theme.accent : theme.border}`,
                background: done ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: "#fff", fontWeight: 800, flexShrink: 0,
              }}>{done ? "✓" : ""}</div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: done ? theme.accent : theme.text }}>{item}</span>
                {done && <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 8 }}>{done}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── GROWTH PAGE ──────────────────────────────────────────────
function GrowthPage({ data, updateData, theme, setModal, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");
  const [date, setDate] = useState(localDateStr());
  const records = (data.growthRecords || []).sort((a, b) => a.date.localeCompare(b.date));

  const addRecord = () => {
    if (!weight && !height && !head) return;
    const rec = { id: uid(), date, weight: weight ? parseFloat(weight) : null, height: height ? parseFloat(height) : null, head: head ? parseFloat(head) : null };
    updateData("growthRecords", [...(data.growthRecords || []), rec]);
    setWeight(""); setHeight(""); setHead(""); setShowForm(false);
    showToast("📏 Growth recorded!");
  };

  const chartData = records.map(r => ({
    date: r.date.slice(5),
    weight: r.weight,
    height: r.height,
    head: r.head,
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>📏 Growth Chart</h2>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: theme.accent, color: "#fff", border: "none", borderRadius: 12,
          padding: "8px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer",
        }}>{showForm ? "Cancel" : "+ Add"}</button>
      </div>

      {showForm && (
        <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, marginBottom: 16, animation: "fadeIn 0.2s ease" }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px", color: theme.text, fontSize: 14, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input placeholder="Weight (lbs)" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)}
              style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px", color: theme.text, fontSize: 14 }} />
            <input placeholder="Height (in)" type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)}
              style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px", color: theme.text, fontSize: 14 }} />
            <input placeholder="Head (in)" type="number" step="0.1" value={head} onChange={e => setHead(e.target.value)}
              style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px", color: theme.text, fontSize: 14 }} />
          </div>
          <button onClick={addRecord} style={{
            width: "100%", padding: 14, borderRadius: 14, background: theme.accent, color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer",
          }}>Save</button>
        </div>
      )}

      {chartData.length > 1 && (
        <div style={{ background: theme.card, borderRadius: 20, padding: "16px 8px 8px 0", border: `1px solid ${theme.border}`, marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingLeft: 16, marginBottom: 8 }}>Weight (lbs)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="date" tick={{ fill: theme.textMuted, fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} width={35} />
              <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.text }} />
              <Line type="monotone" dataKey="weight" stroke={theme.accent} strokeWidth={3} dot={{ fill: theme.accent, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Records list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...records].reverse().map(r => (
          <div key={r.id} className="card" style={{ background: theme.card, borderRadius: 14, padding: "12px 16px", border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{r.date}</span>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              {r.weight && <span style={{ color: theme.accent }}>{r.weight} lbs</span>}
              {r.height && <span style={{ color: theme.info }}>{r.height} in</span>}
              {r.head && <span style={{ color: theme.purple }}>{r.head} in</span>}
              {r.source === "doctor" && <span style={{ fontSize: 11, color: theme.success }}>🩺</span>}
            </div>
          </div>
        ))}
        {records.length === 0 && <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", padding: 30 }}>No growth records yet. Tap "+ Add" to start tracking!</p>}
      </div>
    </div>
  );
}

// ─── AI CO-PILOT PAGE ─────────────────────────────────────────
function CoPilotPage({ data, theme, updateData, showToast }) {
  const [digest, setDigest] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("digest");

  const generateDigest = async () => {
    const key = data.settings?.aiKey;
    const provider = data.settings?.aiProvider || "groq";
    if (!key) { showToast("Set your AI API key in Settings first", "error"); return; }

    setLoading(true);
    const last7 = last7Days();
    const weekLogs = data.logs.filter(l => last7.includes(l.date));
    const summary = {
      bottles: weekLogs.filter(l => l.type === "bottle").length,
      totalOz: weekLogs.filter(l => l.type === "bottle").reduce((s, l) => s + (l.amount || 0), 0),
      diapers: weekLogs.filter(l => l.type === "diaper").length,
      sleepLogs: weekLogs.filter(l => l.type === "sleep").length,
      notes: weekLogs.filter(l => l.type === "note").map(l => l.note),
      milestones: Object.entries(data.milestones || {}).filter(([_, d]) => last7.includes(d)).map(([k]) => k.split('_').slice(1).join(' ')),
    };

    const prompt = `You are a warm, friendly baby care assistant. Generate a 2-3 paragraph weekly digest for ${data.baby.name || "baby"}'s family. Use this data from the past 7 days: ${JSON.stringify(summary)}. Be warm, conversational, highlight trends, celebrate milestones, and note anything parents should watch. Sign off with a fun baby-related emoji.`;

    let endpoint, headers, body;
    if (provider === "groq") {
      endpoint = "https://api.groq.com/openai/v1/chat/completions";
      headers = { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };
      body = { model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 600 };
    } else if (provider === "openai") {
      endpoint = "https://api.openai.com/v1/chat/completions";
      headers = { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };
      body = { model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 600 };
    } else if (provider === "anthropic") {
      endpoint = "https://api.anthropic.com/v1/messages";
      headers = { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
      body = { model: "claude-sonnet-4-20250514", messages: [{ role: "user", content: prompt }], max_tokens: 600 };
    } else if (provider === "gemini") {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`;
      headers = { "Content-Type": "application/json" };
      body = { contents: [{ parts: [{ text: prompt }] }] };
    }

    try {
      const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
      const json = await res.json();
      let text = "";
      if (provider === "anthropic") text = json.content?.[0]?.text || "Error generating digest";
      else if (provider === "gemini") text = json.candidates?.[0]?.content?.parts?.[0]?.text || "Error generating digest";
      else text = json.choices?.[0]?.message?.content || "Error generating digest";
      setDigest(text);
      updateData("familyUpdates", [...(data.familyUpdates || []), { id: uid(), text, date: localDateStr(), timestamp: new Date().toISOString() }]);
    } catch (e) {
      setDigest("Failed to generate digest. Please check your API key and try again.");
      showToast("AI generation failed", "error");
    }
    setLoading(false);
  };

  // Sleep window prediction
  const lastSleep = [...data.logs].reverse().find(l => l.type === "sleep" && l.subtype === "woke_up");
  const avgAwakeTime = (() => {
    const sleepLogs = data.logs.filter(l => l.type === "sleep" && l.subtype === "woke_up" && l.durationMins);
    if (sleepLogs.length < 2) return null;
    // This is simplified - in production you'd calculate time between wakeup and next sleep
    return 120; // placeholder 2hr average
  })();

  return (
    <div>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, marginBottom: 16 }}>🤖 AI Co-Pilot</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[{id:"digest",label:"Weekly Digest"},{id:"insights",label:"Insights"},{id:"history",label:"Past Digests"}].map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? theme.accentSoft : theme.card, border: `1px solid ${tab === t.id ? theme.accent : theme.border}`,
            borderRadius: 14, padding: "8px 14px", color: tab === t.id ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "digest" && (
        <>
          <button className="log-btn" onClick={generateDigest} disabled={loading} style={{
            width: "100%", padding: 20, borderRadius: 20, background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
            color: "#fff", fontWeight: 800, fontSize: 18, border: "none", cursor: "pointer", marginBottom: 16,
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "✨ Generating..." : "✨ Generate Weekly Digest"}
          </button>
          {digest && (
            <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, animation: "fadeIn 0.3s ease" }}>
              <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{digest}</p>
              <button onClick={() => { navigator.clipboard?.writeText(digest); showToast("Copied to clipboard!"); }}
                style={{ marginTop: 12, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "8px 16px", color: theme.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                📋 Copy to Share
              </button>
            </div>
          )}
          <p style={{ fontSize: 12, color: theme.textMuted, textAlign: "center", marginTop: 12 }}>
            Using: {data.settings?.aiProvider?.toUpperCase() || "GROQ"} {data.settings?.aiProvider !== "groq" && "💲"}
          </p>
        </>
      )}

      {tab === "insights" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: theme.info }}>😴 Sleep Window Prediction</h3>
            <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6 }}>
              {lastSleep
                ? `Last woke up at ${lastSleep.time ? formatTime12(lastSleep.time) : "unknown time"}. Based on typical wake windows, the next ideal sleep time is approximately 1.5-2.5 hours after waking.`
                : "Log some sleep cycles to get predictions!"}
            </p>
          </div>
          <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: theme.warning }}>🍼 Feeding Pattern</h3>
            <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6 }}>
              {data.logs.filter(l => l.type === "bottle").length > 5
                ? `Average feeding: ${(data.logs.filter(l => l.type === "bottle").reduce((s,l) => s + (l.amount||0), 0) / data.logs.filter(l => l.type === "bottle").length).toFixed(1)} oz per bottle.`
                : "Log more feedings to see patterns!"}
            </p>
          </div>
          <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: theme.success }}>📊 Diaper Output</h3>
            <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6 }}>
              Track diapers to monitor hydration. Typically 6-8 wet diapers per day indicates good hydration for infants.
            </p>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(data.familyUpdates || []).length === 0 ? (
            <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", padding: 30 }}>No digests yet. Generate your first one!</p>
          ) : (
            [...(data.familyUpdates || [])].reverse().map(u => (
              <div key={u.id} style={{ background: theme.card, borderRadius: 16, padding: 16, border: `1px solid ${theme.border}` }}>
                <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>{u.date}</p>
                <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{u.text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────
function SettingsPage({ data, updateData, theme, showToast }) {
  const settings = data.settings || {};
  const baby = data.baby || { ...DEFAULT_BABY };

  const updateSetting = (key, val) => updateData("settings", { ...settings, [key]: val });
  const updateBaby = (key, val) => updateData("baby", { ...baby, [key]: val });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `wieser-baby-backup-${localDateStr()}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Backup downloaded!");
  };

  const clearData = () => {
    if (window.confirm("Are you sure you want to clear ALL data? This cannot be undone.")) {
      updateData("logs", []);
      updateData("milestones", {});
      updateData("growthRecords", []);
      updateData("familyUpdates", []);
      updateData("pediatricianNotes", []);
      showToast("Data cleared");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>⚙️ Settings</h2>

      {/* Baby Profile */}
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Baby Profile</h3>
        <input placeholder="Baby's name" value={baby.name === "Baby" ? "" : baby.name} onChange={e => updateBaby("name", e.target.value || "Baby")}
          style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 16, marginBottom: 10 }} />
        <label style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4, display: "block" }}>Birth Date</label>
        <input type="date" value={baby.birthDate} onChange={e => updateBaby("birthDate", e.target.value)}
          style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14 }} />
        {baby.birthDate && <p style={{ fontSize: 13, color: theme.accent, marginTop: 8, fontWeight: 700 }}>{ageString(baby.birthDate)}</p>}
      </div>

      {/* Theme */}
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Color Theme</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} className="card" onClick={() => updateSetting("theme", key)} style={{
              background: t.bg, border: `2px solid ${settings.theme === key ? t.accent : t.border}`, borderRadius: 16,
              padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: t.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{t.name}</span>
              {settings.theme === key && <span style={{ fontSize: 12 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* AI Provider */}
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>AI Provider (BYOK)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[{ id: "groq", label: "Groq (Free)", paid: false }, { id: "openai", label: "💲 OpenAI", paid: true }, { id: "anthropic", label: "💲 Claude", paid: true }, { id: "gemini", label: "💲 Gemini", paid: true }].map(p => (
            <button key={p.id} className="card" onClick={() => updateSetting("aiProvider", p.id)} style={{
              background: settings.aiProvider === p.id ? theme.accentSoft : theme.bg,
              border: `1px solid ${settings.aiProvider === p.id ? theme.accent : theme.border}`,
              borderRadius: 12, padding: "10px 14px", cursor: "pointer",
              color: settings.aiProvider === p.id ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 12,
            }}>{p.label}</button>
          ))}
        </div>
        <input type="password" placeholder="API Key" value={settings.aiKey || ""} onChange={e => updateSetting("aiKey", e.target.value)}
          style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14 }} />
        <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>
          {settings.aiProvider === "groq" ? "Free at console.groq.com/keys" : "Requires a paid API key from the provider."}
        </p>
      </div>

      {/* Data Management */}
      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Data</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={exportData} style={{ flex: 1, padding: 14, borderRadius: 14, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            📦 Export Backup
          </button>
          <button onClick={clearData} style={{ flex: 1, padding: 14, borderRadius: 14, background: "rgba(229,115,115,0.1)", border: "1px solid rgba(229,115,115,0.3)", color: "#e57373", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🗑️ Clear All Data
          </button>
        </div>
      </div>

      {/* About */}
      <div style={{ textAlign: "center", padding: 20, color: theme.textMuted }}>
        <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 16 }}><span style={{ color: theme.accent }}>Wieser</span> Baby</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>v{APP_VERSION}</p>
      </div>
    </div>
  );
}

// ─── HISTORY PAGE ─────────────────────────────────────────────
function HistoryPage({ data, theme, updateData, navigateBack, showToast }) {
  const [filterDate, setFilterDate] = useState(localDateStr());
  const [filterType, setFilterType] = useState("all");
  const logs = data.logs.filter(l => l.date === filterDate && (filterType === "all" || l.type === filterType));

  const deleteLog = (id) => {
    if (window.confirm("Delete this log?")) {
      updateData("logs", data.logs.filter(l => l.id !== id));
      showToast("Log deleted");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button>
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>📅 History</h2>
      </div>
      <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
        style={{ width: "100%", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all","bottle","diaper","sleep","medicine","note","teething"].map(t => (
          <button key={t} className="tab-btn" onClick={() => setFilterType(t)} style={{
            background: filterType === t ? theme.accentSoft : theme.card, border: `1px solid ${filterType === t ? theme.accent : theme.border}`,
            borderRadius: 10, padding: "6px 12px", color: filterType === t ? theme.accent : theme.textMuted, fontWeight: 700, fontSize: 11, cursor: "pointer", textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {logs.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", padding: 30 }}>No logs for this date.</p>
        ) : logs.map(log => (
          <div key={log.id} style={{ background: theme.card, borderRadius: 14, padding: "12px 16px", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>{log.type === "bottle" ? "🍼" : log.type === "diaper" ? "💩" : log.type === "sleep" ? "😴" : log.type === "medicine" ? "💊" : log.type === "teething" ? "🦷" : "📝"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {log.type === "bottle" ? `${log.amount} oz ${log.feedType || ""}` : log.type === "diaper" ? log.subtype : log.type === "sleep" ? (log.subtype === "woke_up" ? `Slept ${log.durationMins}m` : "Fell asleep") : log.type === "medicine" ? `${log.name} ${log.dose || ""}` : log.type === "teething" ? log.tooth : log.note?.slice(0, 40) || "Note"}
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{log.time ? formatTime12(log.time) : ""}</div>
            </div>
            <button onClick={() => deleteLog(log.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: theme.textMuted, padding: 4 }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ACTIVITIES PAGE ──────────────────────────────────────────
function ActivitiesPage({ data, theme, navigateBack }) {
  const days = daysOld(data.baby.birthDate);
  const ageMonths = days ? Math.floor(days / 30.44) : 3;

  const activitiesByAge = [
    { range: [0, 3], title: "0-3 Months", activities: [
      { icon: "🎵", name: "Tummy Time with Music", desc: "Place baby on tummy with gentle music. Start with 2-3 minutes." },
      { icon: "👀", name: "Visual Tracking", desc: "Move a bright toy slowly side to side for baby to follow." },
      { icon: "🤲", name: "Gentle Massage", desc: "Soft strokes on arms, legs, and tummy during calm alert time." },
      { icon: "📖", name: "Reading Aloud", desc: "Read board books with high contrast images close to baby's face." },
      { icon: "🪞", name: "Mirror Play", desc: "Show baby their reflection - they'll be fascinated!" },
      { icon: "🎶", name: "Sing Songs", desc: "Sing nursery rhymes with hand motions and facial expressions." },
    ]},
    { range: [3, 6], title: "3-6 Months", activities: [
      { icon: "🧸", name: "Reach & Grab", desc: "Hold toys just within reach to encourage grasping." },
      { icon: "💬", name: "Babble Back", desc: "When baby coos, repeat their sounds back to them." },
      { icon: "🎨", name: "Sensory Play", desc: "Let baby touch different textures - soft fabric, crinkle paper." },
      { icon: "✈️", name: "Airplane", desc: "Gently lift baby in the air - great for core strength and giggles!" },
      { icon: "🫧", name: "Bubble Time", desc: "Blow bubbles for baby to track and reach toward." },
      { icon: "🎵", name: "Musical Instruments", desc: "Soft rattles and shakers they can hold and shake." },
    ]},
    { range: [6, 12], title: "6-12 Months", activities: [
      { icon: "👋", name: "Peekaboo", desc: "Classic game that teaches object permanence!" },
      { icon: "🥣", name: "Food Exploration", desc: "Let baby explore different safe foods with their hands." },
      { icon: "📦", name: "Container Play", desc: "Put toys in and out of containers - endlessly entertaining." },
      { icon: "🎵", name: "Music & Dance", desc: "Play music and dance together - hold baby and sway." },
      { icon: "📚", name: "Lift-the-Flap Books", desc: "Interactive books they can help 'read' themselves." },
      { icon: "🏊", name: "Water Play", desc: "Supervised splash time with cups and toys in a shallow bath." },
    ]},
    { range: [12, 24], title: "1-2 Years", activities: [
      { icon: "🖍️", name: "Coloring", desc: "Large crayons and big paper. It's about the process, not the product!" },
      { icon: "🧱", name: "Block Stacking", desc: "Stack and knock down - teaches cause and effect." },
      { icon: "🎨", name: "Finger Painting", desc: "Washable paint on large paper - messy but magical." },
      { icon: "🌳", name: "Nature Walk", desc: "Explore outside - collect leaves, feel bark, watch bugs." },
      { icon: "🧩", name: "Simple Puzzles", desc: "Chunky knob puzzles with 3-5 pieces." },
      { icon: "🎶", name: "Dance Party", desc: "Play upbeat music and dance together freely!" },
    ]},
    { range: [24, 48], title: "2-4 Years", activities: [
      { icon: "🎭", name: "Pretend Play", desc: "Play kitchen, doctor, store - fuels imagination." },
      { icon: "✂️", name: "Cutting Practice", desc: "Child-safe scissors with thick paper lines to follow." },
      { icon: "🌱", name: "Gardening", desc: "Plant seeds together and watch them grow." },
      { icon: "🍳", name: "Cooking Together", desc: "Simple recipes - stirring, pouring, measuring." },
      { icon: "📖", name: "Story Time", desc: "Longer stories with discussions about characters and feelings." },
      { icon: "🏃", name: "Obstacle Course", desc: "Pillows to climb, tunnels to crawl through, lines to balance on." },
    ]},
    { range: [48, 72], title: "4-6 Years", activities: [
      { icon: "🔬", name: "Science Experiments", desc: "Vinegar volcanoes, mixing colors, growing crystals." },
      { icon: "✏️", name: "Writing Practice", desc: "Tracing letters and writing their name." },
      { icon: "♟️", name: "Board Games", desc: "Simple games that teach taking turns and counting." },
      { icon: "🎨", name: "Art Projects", desc: "Collages, painting, clay sculpting with more structure." },
      { icon: "🚲", name: "Bike Riding", desc: "Balance bike or training wheels - outdoor adventure!" },
      { icon: "📚", name: "Early Reading", desc: "Sound out simple words together, sight word games." },
    ]},
  ];

  const relevant = activitiesByAge.filter(a => ageMonths >= a.range[0] - 1 && ageMonths <= a.range[1] + 3);
  const display = relevant.length > 0 ? relevant : activitiesByAge;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button>
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>🎯 Activities</h2>
      </div>
      {data.baby.birthDate && <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>Showing activities for {ageString(data.baby.birthDate)}</p>}
      {display.map(group => (
        <div key={group.title} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.accent, marginBottom: 10 }}>{group.title}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.activities.map(act => (
              <div key={act.name} className="card" style={{ background: theme.card, borderRadius: 16, padding: "14px 16px", border: `1px solid ${theme.border}`, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{act.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{act.name}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5, marginTop: 2 }}>{act.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── FAMILY PAGE ──────────────────────────────────────────────
function FamilyPage({ data, updateData, theme, navigateBack, showToast }) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const members = data.settings?.familyMembers || [];

  const addMember = () => {
    if (!name) return;
    const updated = [...members, { id: uid(), name, relation }];
    updateData("settings", { ...data.settings, familyMembers: updated });
    setName(""); setRelation("");
    showToast("Family member added!");
  };

  const removeMember = (id) => {
    updateData("settings", { ...data.settings, familyMembers: members.filter(m => m.id !== id) });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={navigateBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: theme.text }}>←</button>
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22 }}>👨‍👩‍👦 Family</h2>
      </div>

      <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Add Family Member</h3>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)}
          style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14, marginBottom: 8 }} />
        <input placeholder="Relation (e.g. Grandma, Uncle)" value={relation} onChange={e => setRelation(e.target.value)}
          style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", color: theme.text, fontSize: 14, marginBottom: 12 }} />
        <button onClick={addMember} disabled={!name} style={{
          width: "100%", padding: 14, borderRadius: 14, background: name ? theme.accent : theme.border,
          color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: name ? "pointer" : "default",
        }}>Add Member</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.map(m => (
          <div key={m.id} className="card" style={{ background: theme.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
              {m.relation && <div style={{ fontSize: 12, color: theme.textMuted }}>{m.relation}</div>}
            </div>
            <button onClick={() => removeMember(m.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: theme.textMuted }}>✕</button>
          </div>
        ))}
        {members.length === 0 && <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", padding: 20 }}>No family members added yet.</p>}
      </div>

      {/* Share Latest Digest */}
      {(data.familyUpdates || []).length > 0 && (
        <div style={{ background: theme.card, borderRadius: 20, padding: 20, border: `1px solid ${theme.border}`, marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Latest Digest</h3>
          <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {data.familyUpdates[data.familyUpdates.length - 1].text.slice(0, 200)}...
          </p>
          <button onClick={() => { navigator.clipboard?.writeText(data.familyUpdates[data.familyUpdates.length - 1].text); showToast("Copied for sharing!"); }}
            style={{ marginTop: 12, width: "100%", padding: 14, borderRadius: 14, background: theme.accentSoft, border: `1px solid ${theme.accent}`, color: theme.accent, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            📋 Copy Latest Digest to Share
          </button>
        </div>
      )}
    </div>
  );
}
