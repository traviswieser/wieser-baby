// ─── Household Sync Component ─────────────────────────────────
// Renders inside the Settings page.
// Handles: create household, join via code, show members, leave.

import { useState, useEffect } from "react";
import {
  createHousehold, joinHousehold, leaveHousehold,
  getHouseholdInfo, getStoredHouseholdId,
} from "./firebase.js";

export default function HouseholdSync({ currentUser, theme, showToast, onHouseholdChange }) {
  const uid         = currentUser?.uid;
  const displayName = currentUser?.displayName || currentUser?.email || "Partner";

  const [householdId, setHouseholdId] = useState(() => getStoredHouseholdId(uid));
  const [household,   setHousehold]   = useState(null);
  const [mode,        setMode]        = useState("idle");  // idle | create | join | joined
  const [inviteCode,  setInviteCode]  = useState("");
  const [inputCode,   setInputCode]   = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [copied,      setCopied]      = useState(false);

  // Load household info on mount / when householdId changes
  useEffect(() => {
    if (!householdId) return;
    getHouseholdInfo(householdId).then(info => {
      if (info) { setHousehold(info); setMode("joined"); }
    }).catch(() => {});
  }, [householdId]);

  const handleCreate = async () => {
    setLoading(true); setError("");
    try {
      const { householdId: hid, inviteCode: code } = await createHousehold(uid, displayName);
      setHouseholdId(hid);
      setInviteCode(code);
      const info = await getHouseholdInfo(hid);
      setHousehold(info);
      setMode("joined");
      showToast("🏠 Household created!");
      onHouseholdChange();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!inputCode.trim()) { setError("Please enter the invite code."); return; }
    setLoading(true); setError("");
    try {
      const { householdId: hid } = await joinHousehold(uid, displayName, inputCode);
      setHouseholdId(hid);
      const info = await getHouseholdInfo(hid);
      setHousehold(info);
      setMode("joined");
      showToast("🔗 Joined household! Syncing data…");
      onHouseholdChange();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes("permission")) {
        setError("Permission error — your Firestore rules need updating. Ask Travis to deploy firestore.rules from the repo, or go to Firebase Console → Firestore → Rules and paste the rules from firestore.rules.");
      } else {
        setError(err.message);
      }
    }
    setLoading(false);
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this household? Your data won't be deleted, but you'll go back to your private account. Your partner will keep the shared data.")) return;
    leaveHousehold(uid);
    setHouseholdId(null);
    setHousehold(null);
    setMode("idle");
    showToast("Left household");
    onHouseholdChange();
  };

  const copyCode = () => {
    const code = household?.inviteCode || inviteCode;
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const t = theme;
  const inp = { width: "100%", padding: "13px 16px", borderRadius: 12, background: t.bg, border: `1px solid ${t.border}`, color: t.text, fontSize: 16, fontFamily: "'Nunito', sans-serif", boxSizing: "border-box" };

  // ── Already in a household ──────────────────────────────────
  if (mode === "joined" && household) {
    const code    = household.inviteCode;
    const members = household.memberNames || [];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Sync status banner */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: `${t.success}18`, border: `1px solid ${t.success}40`, borderRadius: 14, padding: "12px 16px" }}>
          <span style={{ fontSize: 22 }}>🔗</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.success }}>Syncing in real time</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>All changes appear instantly on all devices</div>
          </div>
        </div>

        {/* Members */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Household Members</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map((name, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: t.bg, borderRadius: 12, padding: "10px 14px", border: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 20 }}>{i === 0 ? "👤" : "👤"}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{name}</span>
                {name === displayName && <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, marginLeft: "auto" }}>You</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Invite code — share with partner */}
        <div style={{ background: t.bg, borderRadius: 14, padding: 16, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Invite Code</p>
          <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 10, lineHeight: 1.5 }}>Share this code with your partner so they can join this household.</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 16px", fontFamily: "monospace", fontSize: 24, fontWeight: 900, letterSpacing: 6, color: t.accent, textAlign: "center" }}>
              {code}
            </div>
            <button onClick={copyCode} style={{ padding: "12px 16px", borderRadius: 12, background: copied ? t.success : t.accentSoft, border: `1px solid ${copied ? t.success : t.accent}`, color: copied ? "#fff" : t.accent, fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>

        {/* Leave */}
        <button onClick={handleLeave} style={{ padding: "11px 16px", borderRadius: 12, background: "rgba(229,115,115,0.10)", border: "1px solid rgba(229,115,115,0.3)", color: "#e57373", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Leave Household
        </button>
      </div>
    );
  }

  // ── Not yet in a household ──────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {mode === "idle" && (
        <>
          <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
            Link your account with your partner's so every bottle, diaper, and nap shows up on both phones instantly.
          </p>
          <button onClick={() => { setMode("create"); setError(""); }}
            style={{ padding: "14px 16px", borderRadius: 14, background: t.accent, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>
            🏠 Create Household
          </button>
          <button onClick={() => { setMode("join"); setError(""); }}
            style={{ padding: "14px 16px", borderRadius: 14, background: "transparent", color: t.text, fontWeight: 700, fontSize: 15, border: `1.5px solid ${t.border}`, cursor: "pointer" }}>
            🔗 Join with Invite Code
          </button>
        </>
      )}

      {mode === "create" && (
        <>
          <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
            You'll get a 6-letter code to share with your partner. They enter it on their phone to join.
          </p>
          {error && <p style={{ fontSize: 13, color: "#e57373", background: "rgba(229,115,115,0.1)", borderRadius: 10, padding: "10px 14px" }}>{error}</p>}
          <button onClick={handleCreate} disabled={loading}
            style={{ padding: "15px 16px", borderRadius: 14, background: t.accent, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Creating…" : "Create & Get Code"}
          </button>
          <button onClick={() => { setMode("idle"); setError(""); }}
            style={{ padding: 10, background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 13 }}>
            Cancel
          </button>
        </>
      )}

      {mode === "join" && (
        <>
          <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
            Enter the 6-letter code from your partner's phone.
          </p>
          <input
            placeholder="Enter code (e.g. AB12CD)"
            value={inputCode}
            onChange={e => setInputCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ ...inp, fontSize: 22, fontFamily: "monospace", fontWeight: 900, letterSpacing: 6, textAlign: "center", textTransform: "uppercase" }}
            autoFocus
          />
          {error && <p style={{ fontSize: 13, color: "#e57373", background: "rgba(229,115,115,0.1)", borderRadius: 10, padding: "10px 14px" }}>{error}</p>}
          <button onClick={handleJoin} disabled={loading || inputCode.length < 6}
            style={{ padding: "15px 16px", borderRadius: 14, background: t.accent, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: loading || inputCode.length < 6 ? 0.6 : 1 }}>
            {loading ? "Joining…" : "Join Household"}
          </button>
          <button onClick={() => { setMode("idle"); setError(""); setInputCode(""); }}
            style={{ padding: 10, background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 13 }}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
