# Wieser Baby — Lessons Learned from Prior Apps

> Compiled from `HANDOFF.md` files in **Wieser Workouts** (v43.7) and **Wieser Eats** (v2.1.0).
> Read this before every development session. These are hard-won lessons — don't repeat the same mistakes.

---

## 🌿 Git & Branch Workflow

- **Always work on `dev`. Never push to `main` directly.** Only merge to `main` when Travis explicitly says "deploy."
- **Always use `--rebase` when pulling main** before a merge:
  ```
  git pull origin main --rebase
  ```
  Netlify auto-commits to `main` on deploy, which causes push rejections if you use a regular pull.
- **Deploy command (only when Travis says "deploy"):**
  ```
  git checkout main && git pull origin main --rebase && git merge dev && git push origin main && git checkout dev
  ```
- Strip the token from the remote URL after pushing:
  ```
  git remote set-url origin https://github.com/traviswieser/<repo>.git
  ```

---

## 🏗️ Build System

- **Choose the build system before writing a line of code** — switching mid-project is expensive. Wieser Workouts uses a custom `build.js` (Babel/JSX → single HTML). Wieser Eats migrated away from Parcel to Vite → Python inline script. Commit to one approach.
- **Single-file output is the target.** Both apps inline all JS and CSS into one `index.html`. This simplifies Netlify deployment (no build step needed on the host).
- **Vite strips PWA tags on every build.** Re-inject `<link rel="manifest">`, theme-color, Apple meta tags, and the service worker `<script>` after every build via a post-build Python script.
- **`build.js` output paths** — If `build.js` writes to a special output path (e.g., `/mnt/user-data/outputs/`), guard it with `fs.existsSync()`. That path only exists in the Claude sandbox — it breaks GitHub Actions otherwise.
- **TypeScript:** `tsconfig.app.json` should have `noUnusedLocals: true` and `noUnusedParameters: true`. Fix ALL type errors (`npx tsc --noEmit`) **before** running `npm run build`. Prefix intentionally unused params with `_` (e.g. `_unused`).

---

## 🔥 Firebase / Firestore

- **`firebase-config.js` must stay committed** (Wieser Workouts pattern). If it's gitignored and the build references it as a `<script src>` tag, Netlify won't have it → `window.FIREBASE_CONFIG` is undefined → Firebase never initializes → infinite loading spinner. **Never re-add it to `.gitignore`.**
- **Alternative (Wieser Eats pattern):** Embed the config directly in `firebase.ts`. Firebase client-side keys are safe — they're secured by Firestore rules, not by being secret.
- **Never use `set()` without `merge: true`** for partial updates. `set(data)` with no merge **wipes all other fields** on the document. Always use `set(data, { merge: true })` or `update()` when you only want to change specific fields.
- **Composite document IDs are required** for relationship documents (e.g., `coachUid_athleteUid`). Simple UIDs alone don't work for cross-user documents.
- **No read-before-write** — use `set({ merge: true })` rather than reading first and merging client-side.
- **Firestore security rules** — store shared/household data in a clearly separate collection from per-user data. Don't mix access levels in the same doc.
- **Settings sync** — store per-user settings at `users/{uid}` top-level with `merge: true`. Do NOT use a subcollection — it won't be covered by standard auth rules.
- **Never store private per-user data** (folders, settings, preferences) in a doc that other users need cross-read access to. Keep private data in `prefs`/`settings`, loaded only by the owner's UID.

---

## ⚛️ React Patterns

### State & Routing
- **Single `screen` / `page` state variable** drives all views. This keeps routing simple for a PWA.
- **Always use a named navigate function** (e.g., `navigate(pageName)` / `navigateBack()`) — never call `setPage()` directly. The navigate function maintains page history for Android back button support and fires `window.history.pushState`.

### JSX Gotchas
- **Emoji in JSX: always use literal emoji — never `\uXXXX` escape sequences.** Babel renders `\uXXXX` as raw text, not the actual emoji character.
- **Multiline strings in JSX:** Never embed a literal newline inside a JSX `{"string"}` prop. Use `\n` escapes or template literals. Babel treats raw newlines as unterminated strings.
- **`React.Fragment` in ternary map:** The closing `)` of the ternary false branch must appear immediately after `</React.Fragment>` on the same line. A newline before it unbalances the `))` that closes the arrow function body and Babel throws "Unexpected token, expected ','".
- **`window.confirm()` in JSX:** Use `window.confirm()` (explicit global) with template literals to avoid quote escape issues inside JSX event handlers.

### Async / Loading
- **`onAuthStateChanged` must fire before any data loads.** If Firebase config is missing or broken, the auth listener never fires, `user` stays `null` forever, and the app shows an infinite spinner with no error.
- **Pinned/always-visible nav items** (like a Settings button) should **not** live in user prefs. Hardcode them directly in JSX after the prefs-driven `.map()`. Prefs arrive async — a stored nav item causes a flash-of-default-content on load. Pattern:
  ```jsx
  {(navItems || DEFAULT_NAV).map(...)}
  <button>⚙️ Settings</button>  {/* hardcoded, always visible */}
  ```

---

## 📱 PWA / Mobile

- **iOS safe-area insets** — any `position: fixed` bottom element (nav bar, buttons) must use:
  ```css
  padding-bottom: calc(Npx + env(safe-area-inset-bottom, 0px));
  ```
- **Wake Lock API** — use optional chaining: `navigator.wakeLock?.request("screen")`. Not available in all browsers/contexts. Always handle the `release` event (the OS can override it, e.g., on low battery) and update component state in that handler.
- **Service worker cache versioning** — bump the SW cache version string on every deployment that changes assets. Old SW caches silently serve stale files.
- **Netlify SECRETS_SCAN_SMART_DETECTION** — set `SECRETS_SCAN_SMART_DETECTION_ENABLED = "false"` in `netlify.toml` so Firebase client keys don't trip Netlify's scanner and block deploys.

---

## 🎨 UI & Styling

- **Custom scrollbar CSS kills native auto-hide.** Defining ANY `::-webkit-scrollbar` rule completely replaces the OS native overlay scroll indicator with a persistent custom one. There is no reliable cross-platform way to make a custom scrollbar auto-fade on Android Chrome. Best approach: don't fight it — leave the default scrollbar or hide it entirely with `scrollbar-width: none`.
- **Chart SVG:** Never use `preserveAspectRatio="none"` — it stretches text and numbers. Use `preserveAspectRatio="xMidYMid meet"` with `height="auto"`.
- **Dialog overflow on mobile** — patch `shadcn/ui`'s `DialogContent` to use `w-[calc(100vw-2rem)]` (not `w-full`) and add `overflow-hidden`. This prevents dialogs from overflowing the viewport on small screens.
- **Radix Select inside a Dialog** — add `onPointerDownOutside` and `onInteractOutside` guards to the Dialog component so opening a Select dropdown doesn't accidentally close the dialog.
- **Drag-and-drop on mobile** — when implementing long-press drag:
  - Call `setPointerCapture` on `pointerdown` to prevent scroll stealing during the hold.
  - **Release** pointer capture when the long-press fires so `elementFromPoint` can see drop targets beneath the ghost element.
  - Set `pointer-events: none` on the ghost div (required for `elementFromPoint`).
  - Set `touch-action: none` inline on draggable elements to prevent iOS/Android scroll interception.
  - Register `pointermove` with `{ passive: false }` so `preventDefault()` can block scroll during drag.
- **Theme system** — manage dark/light/auto mode with a `MediaQueryList` listener for `'auto'`. Apply color palette as a CSS variable (`--primary`) on `document.documentElement.style`. Keep theme logic in one place (root component `useEffect` hooks), not scattered across pages.

---

## 📅 Date Handling

- **Never use `toISOString()` for local `YYYY-MM-DD` date strings.** `toISOString()` converts to UTC first, which shifts dates back one day for US timezones (UTC-5 to UTC-8).
- ✅ Always use local time:
  ```ts
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  ```
- ❌ Never:
  ```ts
  new Date().toISOString().split('T')[0]
  ```

---

## 🔐 Security & API Keys

- **Per-user localStorage keys.** Always include the user's UID in any localStorage key (e.g., `appname-settings-{uid}`). A shared/unkeyed key causes data bleed between accounts on the same device.
- **Reset to defaults on UID change** in any settings hook — so the previous user's data doesn't briefly appear when a new user logs in.
- **User-provided API keys** (AI providers, image APIs, etc.) stored in per-user settings. Never hardcode paid API keys in source.
- **Groq endpoint:** `api.groq.com/openai/v1/chat/completions` — not `api.x.ai`. Groq is free at `console.groq.com/keys`.
- **Paid AI providers** (Claude, OpenAI, Gemini) — show a clear visual indicator (e.g., 💲 emoji) next to these options so users know upfront they'll need a paid key.

---

## 🧩 Netlify Functions (Serverless)

- **Netlify Functions only work when deployed** — they return 404 in local dev. This is expected. Don't try to make them work locally.
- **SPA routing + Functions:** In `netlify.toml`, the `/.netlify/*` passthrough rule must come **before** the `/* → index.html 200` SPA catch-all, otherwise function requests get swallowed by the SPA redirect.
- **Server-side fetching** (e.g., scraping recipe pages) needs realistic browser headers to avoid bot detection. Never fetch third-party pages directly from the browser.

---

## 🔄 Versioning & Updates

- **On every new feature release, update ALL of these in one commit:**
  1. The `UPDATES` / changelog array (new entry at the top)
  2. The `LATEST_VERSION` constant
  3. The version number in the Settings "About" section
  4. The `HANDOFF.md` file (session notes + new lessons learned)
- **Update popup** — show it once per version using a localStorage flag keyed to `LATEST_VERSION`. Don't show it on every launch.

---

## 🛠️ Development Process

- **Fix bugs in batches, not one at a time.** Both apps show that grouping 6–12 fixes into a single version commit (e.g., "v42: 10 fixes") is more efficient and keeps the commit history readable.
- **String replacement in complex JSX** — Python `src.find()` + slicing is more reliable than XML-style `str_replace` for complex, multi-line JSX blocks. Use it when the block has nested quotes or special characters.
- **Sentinel strings must be identical everywhere.** A mismatch between a `select value={}` and an `<option value>` (e.g., `"_custom"` vs `"__custom"`) causes React to silently fall back to the first option. Always define sentinels as a named constant.
- **Separate prompts for generation vs. conversion** in AI features. Generation prompts should be open-ended. Conversion/parsing prompts should be strict and deterministic (`temperature: 0.3`). Never use the same prompt for both.
- **`localStorage` deduplication for notifications** — use a keyed localStorage entry (e.g., `appname_seenItems_{uid}`) to prevent the same notification from firing across sessions.

---

## ✅ Pre-Launch Checklist (apply to Wieser Baby)

- [ ] Firebase config embedded or committed — never gitignored in a way that breaks the Netlify build
- [ ] Per-user localStorage keys include UID
- [ ] Settings reset on UID change
- [ ] `position: fixed` bottom elements use `env(safe-area-inset-bottom, 0px)`
- [ ] Emoji used as literals in JSX (not `\uXXXX`)
- [ ] Date strings use local time (not `toISOString()`)
- [ ] `--rebase` used on all `git pull` before merging to `main`
- [ ] PWA meta tags re-injected after every build
- [ ] SW cache version bumped on every deploy
- [ ] Netlify secrets scan disabled in `netlify.toml`
- [ ] All TypeScript errors resolved before building
- [ ] `UPDATES`, `LATEST_VERSION`, Settings About, and `HANDOFF.md` updated on every release
- [ ] `dev` → `main` only on Travis's explicit "deploy" command

---

*Compiled: 2026-03-26 — Sources: `wieser-workouts/HANDOFF.md` (session 15, v43.7) and `wieser-eats/HANDOFF.md` (v2.1.0)*
