# HANDOFF.md — Wieser Baby

> **Last updated:** v2.1.0 · 2026-03-28
> Read this before every dev session. Cross-reference `wieser-baby-lessons-learned.md` for hard-won rules from prior Wieser apps.

---

## Project Overview

**Wieser Baby** is a React PWA for tracking baby/toddler daily care — feeding, sleep, diapers, poop health, food & nutrition, milestones, growth, and AI-generated weekly digests. Built for one-handed operation at 2 AM with massive buttons, true dark mode, and zero friction logging.

| Detail | Value |
|--------|-------|
| Repo | `github.com/traviswieser/wieser-baby` |
| Current version | 2.1.0 |
| Framework | React (functional components + hooks) |
| App entry | `src/App.jsx` (~1300 lines) |
| Firebase | `src/firebase.js` — Firestore + Auth + household helpers |
| Auth | `src/AuthScreen.jsx` — Google + email sign-in page |
| Household | `src/HouseholdSync.jsx` — partner sync UI |
| Notifications | `src/notifications.js` — reminder scheduler |
| Barcode | `src/BarcodeScanner.jsx` — camera scanner |
| Doc upload | `src/DocUpload.jsx` — file attach/preview |
| Charting | Recharts (BarChart, AreaChart, LineChart, PieChart) |
| Fonts | Nunito (body) + Fredoka (headings) via Google Fonts |
| Storage | `window.storage` API (Claude artifact persistent storage) |
| Deployment | Not yet deployed — Netlify planned |
| Branch | `dev` (active work), `main` (deploy-only) |

---

## Git Workflow

**Always work on `dev`.** Never push directly to `main`.

```bash
# Normal workflow
git checkout dev
# ... make changes ...
git add -A && git commit -m "v1.x.x: description"
git push origin dev

# Deploy (ONLY when Travis says "deploy")
git checkout main && git pull origin main --rebase && git merge dev && git push origin main && git checkout dev

# After every push — strip the token
git remote set-url origin https://github.com/traviswieser/wieser-baby.git
```

### ⚠️ Critical Rule: Commit After Each Feature

**Never batch multiple features into one commit.** Claude's context window is limited — if the session runs out of space mid-build, unbatched work is lost permanently. Always commit and push to `dev` immediately after each feature is complete and verified, before starting the next one. This way, every feature is safely preserved in GitHub regardless of what happens to the session.

---

## Commit History

| SHA | Version | Description |
|-----|---------|-------------|
| `f665504` | — | Initial repo with lessons learned doc |
| `03bd9d0` | v1.0.0 | Full app: dashboard, bottles, sleep, diapers, medicine, notes, teething, milestones, growth, AI co-pilot, history, activities, family, 4 themes, data export |
| `a7e9609` | v1.1.0 | Enhanced poop tracking (3-step wizard, 10 colors, 11 consistencies, health analysis, poop patterns page) + food barcode scanner (Open Food Facts API, macro tracking, reactions, food preferences) |
| `6b55b8e` | — | docs: added commit-after-each-feature rule to git workflow |
| `62b5423` | v1.2.0 | Vite build system + PWA manifest (vite-plugin-pwa) + Netlify config |
| `a134894` | v1.3.0 | Firebase/Firestore integration + real-time caregiver sync via `onSnapshot` |
| `5feda09` | v1.4.0 | Camera barcode scanner (`@zxing/library`) with flashlight toggle + camera/manual chooser |
| `4abdff6` | v1.5.0 | Multi-baby support — add babies, switch active baby, per-baby log stamping |
| `11fd132` | v1.6.0 | Push notifications — feeding + medicine reminders with toggle switches in Settings |
| `602c0e2` | v1.7.0 | Predictive sleep windows — `predictNextSleep()` algorithm + dashboard prediction card |
| `8239af9` | v1.8.0 | Pediatrician document upload — attach photos/PDFs to doctor visit notes, gallery in Growth page |
| `58fc877` | v1.9.0 | Google + email/password sign-in page with home screen install instructions |
| `ee5ecc7` | v2.0.0 | Profile photo avatar in header replaces clock; change photo in Settings |
| `4a41a0f` | — | ci: GitHub Actions workflow — auto-build on dev push, deploy to GitHub Pages |
| `8ef5f51` | — | ci: fix Pages workflow — checkout dev, build dist/, deploy via actions/deploy-pages |
| `72a47e8` | — | feat: new app icon (Wieser W logo) |
| `d1567ea` | v2.1.0 | Partner sync — create/join household with 6-letter invite code, real-time shared Firestore data |

---

## Architecture

### Single-File React App

Everything lives in `src/App.jsx`. This is intentional — it outputs as a single artifact in the Claude chat interface. When a build system is added, it will compile to one `index.html` with all JS/CSS inlined (matching the Wieser Workouts/Eats pattern).

### Component Map

```
WieserBabyApp (root)
├── DashboardPage         — Quick log buttons, today summary, activity feed, poop alerts
├── TrendsPage            — 7-day charts: feeding, diapers, sleep, food calories + averages
├── FoodPage              — Sub-tabs: Today (macros), Weekly (charts), Likes & Dislikes, All Foods
│   └── FoodPrefsTab      — Add/remove food likes and dislikes
├── MilestonesPage        — 5 categories, checkbox tracker with dates
├── CoPilotPage           — AI digest generator, insights, past digests
├── SettingsPage          — Baby profile, themes, AI provider, data export, nav to sub-pages
├── GrowthPage            — Weight/height/head tracking + line chart
├── HistoryPage           — Date picker + type filter, delete individual logs
├── ActivitiesPage        — Age-filtered developmental activities (0–6 years)
├── FamilyPage            — Family members + digest sharing
├── PoopLogPage           — 14-day frequency chart, color pie chart, pattern insights, log history
│
├── Modals (rendered inside bottom sheet):
│   ├── PoopModal         — 3-step wizard: Color → Consistency → Details + health verdict
│   ├── FoodLogModal      — Manual entry with 10 quick-pick foods + reaction tracking
│   ├── BarcodeScanModal  — Open Food Facts API lookup + macros + servings adjuster
│   ├── BottleModal       — Quick-pick oz amounts + feed type
│   ├── MedicineModal     — Quick-pick common meds + dose
│   ├── NoteModal         — Free-text note
│   ├── TeethingModal     — Tooth selector + symptoms
│   └── DoctorModal       — Visit date, weight, height, notes
│
└── Shared Components:
    ├── QuickLogButton    — Big colored button with icon + sublabel
    ├── SummaryBubble     — Stat circle (icon, value, unit, sub)
    ├── QuickAction       — Small icon button for secondary actions
    ├── SectionLabel      — Uppercase muted section header
    └── MacroBox          — Nutrition stat box (value + unit + label)
```

### Navigation System

Navigation uses a `page` state string + `pageHistory` array for back-button support:

```jsx
const navigate = (p) => { setPageHistory(h => [...h, page]); setPage(p); };
const navigateBack = () => { /* pops from history, falls back to "dashboard" */ };
```

The Android/browser back button is handled via a `popstate` listener that calls `navigateBack()`.

**Bottom nav tabs:** Home, Trends, Food, Stars, AI, More — these reset the history stack when tapped.

**Sub-pages** (Growth, History, Activities, Family, Poop Log) — navigated to via `navigate()`, which preserves back-button history.

### Data Model

All app data is stored as a single JSON blob in Firestore. The path depends on whether the user is in a household:

- **Solo:** `users/{uid}/data/main`
- **Household (partner sync):** `households/{householdId}/data/main`

The active path is determined at runtime by checking `localStorage` for `wieser-baby-household-{uid}`. When a user joins a household their writes automatically switch to the shared path, and `onSnapshot` keeps both partners in sync in real time.

The data schema (same for both paths):

```javascript
{
  baby: { name: "Baby", birthDate: "", photo: "" },
  logs: [
    // Each log has: id, type, date (YYYY-MM-DD), time (HH:MM), timestamp (ISO), ...type-specific fields
    // Types: "bottle", "sleep", "diaper", "poop", "food", "medicine", "note", "teething"
  ],
  milestones: { "motor_Rolls over": "2026-03-15", ... },  // key → date achieved
  growthRecords: [{ id, date, weight, height, head, source? }],
  settings: {
    theme: "midnight",        // "midnight" | "ocean" | "blossom" | "forest"
    aiProvider: "groq",       // "groq" | "openai" | "anthropic" | "gemini"
    aiKey: "",
    familyMembers: [{ id, name, relation }],
  },
  familyUpdates: [{ id, text, date, timestamp }],
  sleepState: null | { startTime: ISO },   // non-null = baby is sleeping
  pediatricianNotes: [{ id, date, weight, height, note, timestamp }],
  foodPreferences: { likes: ["banana", ...], dislikes: ["peas", ...] },
}
```

### Log Type Schemas

| Type | Key Fields |
|------|-----------|
| `bottle` | `amount` (oz), `feedType` (formula/breast/milk/water/juice) |
| `sleep` | `subtype` (woke_up), `durationMins`, `sleepStart` |
| `diaper` | `subtype` (wet) — simple wet-only log |
| `poop` | `color`, `consistency`, `amount` (small/medium/large/blowout), `notes` |
| `food` | `foodName`, `servingSize`, `calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, `reaction`, `barcode?`, `source?` |
| `medicine` | `name`, `dose` |
| `note` | `note` (free text) |
| `teething` | `tooth`, `symptoms` |

### Poop Health Analysis

Each poop color and consistency has a `status` field: `"healthy"`, `"watch"`, or `"alert"`.

The **PoopModal** shows a real-time health verdict after both color and consistency are selected. The **Dashboard** shows an alert card if the most recent poop has watch/alert status. The **PoopLogPage** aggregates patterns over 14 days.

10 colors (yellow, mustard, brown, tan, green, dark green, orange, red, black, white) and 11 consistencies (liquid, runny, mushy, peanut butter, seedy, formed, firm, pellets, clumpy, mucousy, frothy).

### Food & Barcode Scanner

**Manual entry** offers 10 quick-pick baby foods with pre-filled macros (banana, avocado, sweet potato, yogurt, cheerios, apple sauce, egg, PB, rice cereal, puffs). Full macro fields: calories, protein, carbs, fat, fiber, sugar.

**Barcode scanner** calls Open Food Facts API:
```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```
Returns product name, brand, image, Nutri-Score, and per-serving nutriments. Servings are adjustable before logging.

**Reactions** (😍 Loved / 😊 Liked / 😐 Meh / 🙅 Refused) auto-update `foodPreferences.likes` and `foodPreferences.dislikes`.

### AI Co-Pilot (BYOK)

Supports 4 providers:
- **Groq** (free) — `api.groq.com/openai/v1/chat/completions` with `llama-3.3-70b-versatile`
- **OpenAI** (paid) — `gpt-4o-mini`
- **Anthropic** (paid) — `claude-sonnet-4-20250514`
- **Gemini** (paid) — `gemini-pro` via `generativelanguage.googleapis.com`

The weekly digest prompt includes feeding, diaper, sleep, poop patterns (colors, consistencies), food intake, food preferences, milestones, and notes from the past 7 days.

### Theming

4 themes defined as objects with 12 color tokens each:
- **Midnight** (default) — deep black, coral accent
- **Ocean** — navy blue, cyan accent
- **Blossom** — warm cream, rose accent (light mode)
- **Forest** — deep green, lime accent

Colors are applied via inline styles. The `theme` object is passed as a prop to every component.

---

## Key Patterns & Rules

These are distilled from `wieser-baby-lessons-learned.md` — the ones that apply right now:

1. **Dates** — Always use `localDateStr()` helper (local time). Never use `toISOString().split('T')[0]` — it shifts dates in US timezones.
2. **Emoji** — Always use literal emoji in JSX, never `\uXXXX` escape sequences (Babel renders them as raw text).
3. **Navigation** — Always use `navigate()` / `navigateBack()`, never call `setPage()` directly.
4. **Safe area** — All `position: fixed` bottom elements use `env(safe-area-inset-bottom, 0px)`.
5. **Storage** — Single key (`wieser-baby-data`), whole-object read/write. No partial updates.
6. **Scrollbar** — Hidden with `scrollbar-width: none` / `::-webkit-scrollbar { width: 0 }`.
7. **Charts** — Recharts with `preserveAspectRatio="xMidYMid meet"` (Recharts handles this internally via `<ResponsiveContainer>`).
8. **Firebase writes** — Always use `setDoc(..., { merge: true })`, never plain `setDoc()`. Plain writes nuke fields not included in the payload.
9. **Firestore data path** — Determined at runtime: solo = `users/{uid}/data/main`, household = `households/{householdId}/data/main`. Path is resolved in `firebase.js` via `getDataDocRef(uid, householdId)`. Never hardcode the path elsewhere.
10. **Auth guard** — `currentUser === undefined` means Firebase hasn't resolved yet (show splash). `null` means signed out (show AuthScreen). Object means signed in (show app).
11. **Household join flow** — Joining copies the household path into `localStorage` keyed to the user's UID. `loadUserData` + `saveUserData` + `subscribeToUserData` all read that key to pick the right Firestore path automatically.
12. **Google sign-in on mobile** — Must use `signInWithRedirect` (not popup). Popup is blocked by iOS/Android WebView. Always call `checkRedirectResult()` on app mount to catch the result after the page reload.

---

## What's Built (v2.1.0)

All originally planned features are now implemented:

- [x] **Firebase/Firestore** — `src/firebase.js`. Real-time sync via `onSnapshot`. Uses `set({merge:true})`. Per-user localStorage fallback keyed to UID.
- [x] **PWA manifest + service worker** — `vite-plugin-pwa` handles SW generation. Apple meta tags in `index.html`. Offline caching via Workbox.
- [x] **Vite build system** — `vite.config.js` + `build-post.js` verification script. `npm run build` → `dist/`.
- [x] **Netlify deployment** — `netlify.toml` configured with `SECRETS_SCAN_SMART_DETECTION_ENABLED = "false"`, SPA catch-all redirect.
- [x] **Camera barcode scanning** — `src/BarcodeScanner.jsx` using `@zxing/library`. Flashlight toggle, animated crosshair overlay, graceful camera-denied fallback.
- [x] **Pediatrician document upload** — `src/DocUpload.jsx`. Images auto-resized to 800px before base64 encoding. PDF download links. Gallery shown in Growth page.
- [x] **Predictive sleep windows** — `predictNextSleep()` in `App.jsx`. Analyzes last 20 sleep logs, computes avg awake window, shows dashboard card with confidence level.
- [x] **Multi-baby support** — `activeBabyId` + `babies[]` array. Data migration for existing single-baby users. Per-baby log stamping. Baby switcher in header + Settings.
- [x] **Push notifications** — `src/notifications.js`. Feeding reminder (configurable interval) + medicine check. Toggle switches in Settings. `localStorage`-persisted preferences.
- [x] **Google + email/password auth** — `src/AuthScreen.jsx`. Sign in, create account, forgot password. Google OAuth (popup on desktop, redirect on mobile). Friendly error messages.
- [x] **Profile photo in header** — Replaces the clock. Taps to Settings. Change photo via camera or file picker; resized to 256×256, stored in Firebase Auth profile.
- [x] **Home screen install instructions** — Collapsible accordion on the sign-in page. Auto-detects iOS/Android/Desktop and shows the right steps. All 3 platforms available via expandable sections.
- [x] **GitHub Actions / GitHub Pages** — `.github/workflows/deploy-pages.yml`. Every push to `dev` triggers a Vite build (with Firebase secrets injected) and deploys to `traviswieser.github.io/wieser-baby/` for free preview before Netlify deploy.
- [x] **Partner / household sync** — `src/HouseholdSync.jsx` + `firebase.js`. One partner creates a household and gets a 6-letter invite code; the other enters it to join. Both phones then read/write the same Firestore document path (`households/{id}/data/main`) with live `onSnapshot` sync. Firestore rules updated to allow multi-UID access.

## Ideas for Future Development

- [ ] **Firebase Authentication upgrade** — Currently anonymous auth. Could add Google sign-in so caregivers share data across devices without losing history.
- [ ] **Firebase Storage for large files** — Current doc upload is base64 in Firestore (capped at ~900 KB). For full-size photos/PDFs, Firebase Storage would remove the size limit.
- [ ] **Background push notifications** — Current reminders only fire while the app is open. True background notifications need a VAPID push server (e.g., Netlify Functions + web-push npm package).
- [ ] **Sleep prediction ML** — Current prediction uses simple averaging. Could use a lightweight ML model trained on the baby's own patterns for higher accuracy.
- [ ] **Export to PDF** — Currently exports raw JSON. A formatted PDF growth report (charts + notes) would be useful for pediatrician visits.
- [ ] **Sibling data sharing** — Multi-baby data is currently all in one Firestore document. For families with many kids, per-baby Firestore sub-collections would scale better.
- [ ] **Household member removal** — Currently a member can only leave themselves. An admin/owner could remove a member via `updateDoc` with `arrayRemove` on `memberUids`.
- [ ] **Household rename** — The household document has no display name yet. Could add a name field (e.g. "The Wieser Family") shown in the Partner Sync card.
- [ ] **Push notifications for partner actions** — e.g. "Your partner just logged a feeding". Would require a server-side Cloud Function + VAPID/FCM. Currently notifications are local only.

---

## Release Checklist

On every new version, update ALL of these in one commit:

1. `APP_VERSION` constant in `src/App.jsx`
2. Version in Settings page "About" section (rendered from `APP_VERSION`)
3. This `HANDOFF.md` file (add commit to history table, update "What's NOT Built Yet" if applicable)
4. Commit message format: `v1.x.x: Short description`

When a build system and update popup are added, also update:
- `UPDATES` / changelog array (new entry at top)
- `LATEST_VERSION` constant
- Service worker cache version string

---

## File Structure

```
wieser-baby/
├── src/
│   ├── App.jsx              # Main app — all pages, modals, logic (~1300 lines)
│   ├── main.jsx             # React entry point
│   ├── firebase.js          # Firebase init, auth, Firestore + household helpers
│   ├── AuthScreen.jsx       # Sign-in page (Google + email/password + install guide)
│   ├── HouseholdSync.jsx    # Partner sync UI (create household, join, member list)
│   ├── notifications.js     # Reminder scheduler (feeding, medicine)
│   ├── BarcodeScanner.jsx   # Full-screen camera scanner (@zxing/library)
│   └── DocUpload.jsx        # File upload button + base64 encoder + gallery
├── public/
│   ├── icon-192.png         # PWA icon
│   ├── icon-512.png         # PWA icon (maskable)
│   └── apple-touch-icon.png # iOS home screen icon
├── dist/                    # Build output (git-ignored)
├── index.html               # App shell with PWA meta tags + Google Fonts
├── vite.config.js           # Vite + vite-plugin-pwa config
├── build-post.js            # Post-build verification (checks dist/ output)
├── netlify.toml             # Netlify build + redirect + security headers
├── package.json             # Dependencies (React, Firebase, Recharts, ZXing…)
├── .github/
│   └── workflows/
│       └── deploy-pages.yml # Auto-build + deploy to GitHub Pages on every dev push
├── .gitignore               # Ignores node_modules/, dist/, .env
├── wieser-baby-lessons-learned.md  # Hard-won rules from prior Wieser apps
└── HANDOFF.md               # This file
```

---

*Last session: 2026-03-28 — Built v1.9.0–v2.1.0: Google + email auth with install guide, profile photo avatar (replaces clock), GitHub Actions auto-deploy to GitHub Pages for free dev preview, and partner/household sync with invite code + real-time Firestore sharing. All committed to `dev`. Say "deploy" to push to `main` + Netlify.*
