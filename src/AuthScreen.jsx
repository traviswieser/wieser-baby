// ─── Auth Screen ──────────────────────────────────────────────
// Sign-in page shown before the main app loads.
// Supports: Google OAuth, Email/Password (login + register),
//           password reset, and bottom install instructions.

import { useState, useEffect } from "react";
import {
  signInWithGoogle, checkRedirectResult,
  loginWithEmail, registerWithEmail, resetPassword,
} from "./firebase.js";

// ─── Install instructions per platform ───────────────────────
const INSTALL_STEPS = {
  ios: {
    icon: "",
    label: "iPhone / iPad",
    steps: [
      { icon: "1️⃣", text: "Tap the Share button at the bottom of Safari (the box with an arrow pointing up)" },
      { icon: "2️⃣", text: 'Scroll down and tap "Add to Home Screen"' },
      { icon: "3️⃣", text: 'Tap "Add" in the top right — done!' },
    ],
    note: "Must be using Safari. Chrome on iOS doesn't support install.",
  },
  android: {
    icon: "",
    label: "Android",
    steps: [
      { icon: "1️⃣", text: "Open the app in Chrome" },
      { icon: "2️⃣", text: 'Tap the three-dot menu ⋮ in the top right' },
      { icon: "3️⃣", text: 'Tap "Add to Home screen" or "Install app"' },
      { icon: "4️⃣", text: 'Tap "Add" to confirm — done!' },
    ],
    note: "A prompt may appear automatically at the bottom of Chrome.",
  },
  desktop: {
    icon: "🖥️",
    label: "Desktop (Chrome / Edge)",
    steps: [
      { icon: "1️⃣", text: "Look for the install icon (⊕) in the address bar on the right" },
      { icon: "2️⃣", text: 'Click it and choose "Install"' },
      { icon: "3️⃣", text: "The app will open in its own window — pin it to your taskbar!" },
    ],
    note: "Works in Chrome, Edge, and Brave. Not supported in Firefox or Safari on Mac.",
  },
};

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

// ─── Google "G" SVG logo ──────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.08-6.08C34.46 3.08 29.49 1 24 1 14.84 1 7.06 6.48 3.56 14.22l7.07 5.49C12.36 13.42 17.72 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.52 24.5c0-1.56-.14-3.06-.4-4.5H24v8.52h12.7c-.55 2.94-2.2 5.44-4.67 7.12l7.14 5.55C43.28 37.4 46.52 31.42 46.52 24.5z"/>
      <path fill="#FBBC05" d="M10.63 28.29A14.56 14.56 0 0 1 9.5 24c0-1.49.26-2.93.71-4.29L3.14 14.22A23.08 23.08 0 0 0 1 24c0 3.74.9 7.27 2.56 10.36l7.07-5.49-.01-.58z" />
      <path fill="#34A853" d="M24 47c5.49 0 10.1-1.82 13.47-4.93l-7.14-5.55c-1.98 1.33-4.52 2.12-6.33 2.12-6.28 0-11.64-3.93-13.37-9.35l-7.07 5.49C7.06 41.52 14.84 47 24 47z"/>
      <path fill="none" d="M1 1h46v46H1z"/>
    </svg>
  );
}

// ─── Main AuthScreen component ────────────────────────────────
export default function AuthScreen({ onSignedIn, theme }) {
  const [tab, setTab]           = useState("login");   // "login" | "register" | "reset"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const platform = detectPlatform();

  // Catch Google redirect result on mount (any redirect flow)
  useEffect(() => {
    checkRedirectResult().then((user) => {
      if (user) {
        console.log("AuthScreen: redirect sign-in succeeded", user.email);
        onSignedIn(user);
      } else {
        console.log("AuthScreen: no redirect user found");
      }
    }).catch((err) => {
      console.error("AuthScreen: redirect error", err);
      setError("Google sign-in failed: " + (err.message || err.code || "unknown error"));
    });
  }, []);

  const clearMessages = () => { setError(""); setInfo(""); };

  const friendlyError = (code) => {
    const map = {
      "auth/user-not-found":        "No account found with that email.",
      "auth/wrong-password":        "Incorrect password. Try again or reset it.",
      "auth/invalid-credential":    "Incorrect email or password.",
      "auth/email-already-in-use":  "An account already exists with that email.",
      "auth/weak-password":         "Password must be at least 6 characters.",
      "auth/invalid-email":         "Please enter a valid email address.",
      "auth/popup-closed-by-user":  "Sign-in cancelled.",
      "auth/network-request-failed":"Network error — check your connection.",
    };
    return map[code] || "Something went wrong. Please try again.";
  };

  const handleGoogle = async () => {
    clearMessages(); setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) onSignedIn(user); // null on mobile (redirect flow)
    } catch (err) {
      console.error("Google sign-in error:", err.code, err.message);
      setError(friendlyError(err.code));
    }
    setLoading(false);
  };

  const handleEmailSubmit = async () => {
    clearMessages();
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (tab !== "reset" && !password) { setError("Please enter your password."); return; }
    setLoading(true);
    try {
      if (tab === "login") {
        const user = await loginWithEmail(email.trim(), password);
        onSignedIn(user);
      } else if (tab === "register") {
        if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
        const user = await registerWithEmail(email.trim(), password, name.trim());
        onSignedIn(user);
      } else if (tab === "reset") {
        await resetPassword(email.trim());
        setInfo("Check your email for a password reset link.");
        setTab("login");
      }
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  };

  const t = theme;

  const inputSt = {
    width: "100%", padding: "14px 16px", borderRadius: 14,
    background: t.bg, border: `1px solid ${t.border}`,
    color: t.text, fontSize: 16, fontFamily: "'Nunito', sans-serif",
    outline: "none", boxSizing: "border-box",
  };
  const btnPrimary = {
    width: "100%", padding: "15px 16px", borderRadius: 14,
    background: t.accent, color: "#fff",
    fontWeight: 800, fontSize: 16, border: "none",
    cursor: loading ? "default" : "pointer",
    opacity: loading ? 0.6 : 1,
    fontFamily: "'Nunito', sans-serif",
  };
  const btnOutline = {
    width: "100%", padding: "14px 16px", borderRadius: 14,
    background: "transparent", color: t.text,
    fontWeight: 700, fontSize: 15,
    border: `1.5px solid ${t.border}`,
    cursor: "pointer", fontFamily: "'Nunito', sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  };

  const install = INSTALL_STEPS[platform];

  return (
    <>
      <style>{`body { background: ${t.bg} !important; margin: 0; }`}</style>
      <div style={{
        minHeight: "100vh", background: t.bg, color: t.text,
        fontFamily: "'Nunito', sans-serif",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "0 0 60px",
      }}>
      {/* ── Header ── */}
      <div style={{ textAlign: "center", padding: "48px 24px 32px" }}>
        <img src={`${import.meta.env.BASE_URL}icon-1024.png`} alt="Wieser Baby" style={{ width: 120, height: 120, borderRadius: 28, marginBottom: 16, display: "block", margin: "0 auto 16px", imageRendering: "auto" }} />
        <h1 style={{
          fontFamily: "'Fredoka', sans-serif", fontSize: 36,
          fontWeight: 700, margin: 0,
        }}>
          <span style={{ color: t.accent }}>Wieser</span> Baby
        </h1>
        <p style={{ color: t.textMuted, fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
          Track feeding, sleep, diapers,<br />milestones & more
        </p>
      </div>

      {/* ── Card ── */}
      <div style={{
        width: "100%", maxWidth: 420, padding: "0 20px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>

        {/* Google button */}
        <button onClick={handleGoogle} disabled={loading} style={btnOutline}>
          <GoogleLogo />
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
          <div style={{ flex: 1, height: 1, background: t.border }} />
          <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 600 }}>or</span>
          <div style={{ flex: 1, height: 1, background: t.border }} />
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", background: t.card,
          borderRadius: 14, padding: 4, border: `1px solid ${t.border}`,
        }}>
          {[["login","Sign In"], ["register","Create Account"]].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); clearMessages(); }}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 11,
                background: tab === id ? t.accent : "transparent",
                color: tab === id ? "#fff" : t.textMuted,
                fontWeight: 700, fontSize: 14, border: "none",
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                transition: "all 0.15s",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tab === "register" && (
            <input
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputSt}
              autoComplete="name"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
            style={inputSt}
            autoComplete="email"
            inputMode="email"
          />
          {tab !== "reset" && (
            <input
              type="password"
              placeholder={tab === "register" ? "Create a password (6+ chars)" : "Password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
              style={inputSt}
              autoComplete={tab === "register" ? "new-password" : "current-password"}
            />
          )}
        </div>

        {/* Error / info messages */}
        {error && (
          <div style={{
            background: "rgba(229,115,115,0.12)", border: "1px solid rgba(229,115,115,0.3)",
            borderRadius: 12, padding: "12px 16px",
            fontSize: 14, color: "#e57373", lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
        {info && (
          <div style={{
            background: `${t.success}20`, border: `1px solid ${t.success}50`,
            borderRadius: 12, padding: "12px 16px",
            fontSize: 14, color: t.success, lineHeight: 1.5,
          }}>
            {info}
          </div>
        )}

        {/* Submit button */}
        <button onClick={handleEmailSubmit} disabled={loading} style={btnPrimary}>
          {loading ? "Please wait…" : tab === "login" ? "Sign In" : tab === "register" ? "Create Account" : "Send Reset Email"}
        </button>

        {/* Forgot password link */}
        {tab === "login" && (
          <button onClick={() => { setTab("reset"); clearMessages(); }}
            style={{ background: "none", border: "none", color: t.textMuted, fontSize: 13, cursor: "pointer", padding: "4px 0", fontFamily: "'Nunito', sans-serif" }}>
            Forgot password?
          </button>
        )}
        {tab === "reset" && (
          <button onClick={() => { setTab("login"); clearMessages(); }}
            style={{ background: "none", border: "none", color: t.textMuted, fontSize: 13, cursor: "pointer", padding: "4px 0", fontFamily: "'Nunito', sans-serif" }}>
            ← Back to sign in
          </button>
        )}
      </div>

      {/* ── Install Instructions ── */}
      <div style={{ width: "100%", maxWidth: 420, padding: "32px 20px 0" }}>
        <button
          onClick={() => setShowInstall(v => !v)}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 16,
            background: t.card, border: `1px solid ${t.border}`,
            color: t.textMuted, fontWeight: 700, fontSize: 14,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <span>📲 Add to Home Screen</span>
          <span style={{ fontSize: 18, transition: "transform 0.2s", transform: showInstall ? "rotate(180deg)" : "none" }}>⌄</span>
        </button>

        {showInstall && (
          <div style={{
            marginTop: 10, background: t.card, borderRadius: 20,
            border: `1px solid ${t.border}`, overflow: "hidden",
            animation: "fadeIn 0.2s ease",
          }}>
            {/* Platform tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
              {Object.entries(INSTALL_STEPS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => {}}
                  style={{
                    flex: 1, padding: "12px 4px", border: "none",
                    background: key === platform ? t.accentSoft : "transparent",
                    color: key === platform ? t.accent : t.textMuted,
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                    fontFamily: "'Nunito', sans-serif",
                    borderBottom: key === platform ? `2px solid ${t.accent}` : "2px solid transparent",
                  }}
                >
                  {val.icon} {val.label}
                </button>
              ))}
            </div>

            {/* Steps for detected platform */}
            <div style={{ padding: "20px 20px 16px" }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: t.accent, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {install.label}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {install.steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.3 }}>{step.icon}</span>
                    <p style={{ fontSize: 14, color: t.text, lineHeight: 1.55, margin: 0 }}>{step.text}</p>
                  </div>
                ))}
              </div>
              {install.note && (
                <p style={{
                  marginTop: 16, fontSize: 12, color: t.textMuted,
                  background: t.bg, borderRadius: 10, padding: "10px 12px",
                  lineHeight: 1.5, borderLeft: `3px solid ${t.accent}`,
                }}>
                  💡 {install.note}
                </p>
              )}

              {/* All 3 platforms shown below detected one */}
              {Object.entries(INSTALL_STEPS).filter(([k]) => k !== platform).map(([key, val]) => (
                <details key={key} style={{ marginTop: 14 }}>
                  <summary style={{ fontSize: 13, color: t.textMuted, cursor: "pointer", fontWeight: 700, padding: "4px 0" }}>
                    {val.icon} {val.label} instructions
                  </summary>
                  <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {val.steps.map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{step.icon}</span>
                        <p style={{ fontSize: 13, color: t.text, lineHeight: 1.5, margin: 0 }}>{step.text}</p>
                      </div>
                    ))}
                    {val.note && <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontStyle: "italic" }}>💡 {val.note}</p>}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: t.textMuted, marginTop: 32, textAlign: "center", padding: "0 20px" }}>
        By signing in you agree to keep your baby's data safe. ❤️
      </p>
    </div>
    </>
  );
}
