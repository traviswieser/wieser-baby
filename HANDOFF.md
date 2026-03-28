# HANDOFF.md — Wieser Baby

> **Last updated:** v2.6.0 · 2026-03-28
> Read this before every dev session. Cross-reference `wieser-baby-lessons-learned.md` for hard-won rules from prior Wieser apps.

---

## Project Overview

**Wieser Baby** is a React PWA for tracking baby/toddler daily care — feeding, sleep, diapers, poop health, food & nutrition, milestones, growth, and AI-generated daily digests. Built for one-handed operation at 2 AM with massive buttons, true dark mode, and zero friction logging.

| Detail | Value |
|--------|-------|
| Repo | `github.com/traviswieser/wieser-baby` |
| Current version | 2.6.0 |
| Framework | React (functional components + hooks) |
| App entry | `src/App.jsx` (~1700 lines) |
| Firebase | `src/firebase.js` — Firestore + Auth + household helpers |
| Auth | `src/AuthScreen.jsx` — Google + email sign-in page |
| Household | `src/HouseholdSync.jsx` — partner sync UI |
| Notifications | `src/notifications.js` — feeding, medicine, nap schedulers |
| Barcode | `src/BarcodeScanner.jsx` — camera scanner |
| Doc upload | `src/DocUpload.jsx` — file attach/preview |
| Charting | Recharts (BarChart, AreaChart, LineChart, PieChart) |
| Fonts | Nunito (body) + Fredoka (headings) via Google Fonts |
| Deployment | Netlify (via GitHub Actions on `main` push) |
| Branch | `dev` (active work), `main` (deploy-only) |

---

## Git Workflow

**Always work on `dev`.** Never push directly to `main`.

```bash
git config user.email "travis@wieserbaby.app"
git config user.name "Travis Wieser"

# Normal workflow
git checkout dev
# ... make changes ...
git add -A && git commit -m "vX.X.X: description"
git push origin dev
# Strip token after push:
git remote set-url origin https://github.com/traviswieser/wieser-baby.git

# Deploy (ONLY when Travis says "deploy")
git checkout main && git pull origin main --rebase && git merge dev && git push origin main && git checkout dev
```

---

## Commit History

| SHA | Version | Description |
|-----|---------|-------------|
| `f665504` | — | Initial repo with lessons learned doc |
| `03bd9d0` | v1.0.0 | Full app: dashboard, bottles, sleep, diapers, medicine, notes, teething, milestones, growth, AI co-pilot, history, activities, family, 4 themes, data export |
| `a7e9609` | v1.1.0 | Enhanced poop tracking + food barcode scanner |
| `62b5423` | v1.2.0 | Vite build system + PWA manifest + Netlify config |
| `a134894` | v1.3.0 | Firebase/Firestore integration + real-time caregiver sync |
| `5feda09` | v1.4.0 | Camera barcode scanner with flashlight toggle |
| `4abdff6` | v1.5.0 | Multi-baby support |
| `11fd132` | v1.6.0 | Push notifications — feeding + medicine reminders |
| `602c0e2` | v1.7.0 | Predictive sleep windows |
| `8239af9` | v1.8.0 | Pediatrician document upload |
| `58fc877` | v1.9.0 | Google + email/password sign-in page |
| `ee5ecc7` | v2.0.0 | Profile photo avatar in header |
| `4a41a0f` | — | GitHub Actions auto-deploy to GitHub Pages |
| `d1567ea` | v2.1.0 | Partner sync — create/join household with 6-letter invite code |
| `505fa62` | v2.2.0 | New logo, desktop layout fix, auto theme, last-name title, 4 new color themes (Sky, Lavender, Mint, Galaxy), Baby Co-Pilot rename, auth screen white border fix |
| `f6a3679` | v2.3.0 | Household firestore.rules fix, Multivitamin+Melatonin in meds, bottle stepper redesign, sleep hrs/mins display, Sleep Start Now vs Edit Start Time prompt |
| `cb723a8` | v2.4.0 | Edit past logs for all types (bottle, sleep, poop, food, medicine, note, teething) via ✏️ button in History |
| `3af714a` | v2.5.0 | Editable food quick picks, editable milestone dates (📅 button), nap reminders with custom times |
| `727703c` | v2.6.0 | Auto-generate daily AI digest at start of each day, improved Baby Co-Pilot (Today/Insights/History tabs, sleep insights) |

---

## Architecture

### Component Map

```
WieserBabyApp (root)
├── DashboardPage         — Quick log buttons, today summary, sleep prediction, poop alerts
├── TrendsPage            — 7-day charts: feeding, diapers, sleep, food calories + averages
├── FoodPage              — Sub-tabs: Today (macros), Weekly (charts), Likes & Dislikes, All Foods
├── MilestonesPage        — 5 categories, checkbox tracker with editable completion dates
├── CoPilotPage           — Auto-daily digest, insights, past digests history
├── SettingsPage          — Baby profile, themes (8 + auto), AI provider, nap reminders, data export
├── GrowthPage            — Weight/height/head tracking + line chart
├── HistoryPage           — Date picker + type filter, edit ✏️ + delete ✕ per log
├── ActivitiesPage        — Age-filtered developmental activities (0–6 years)
├── FamilyPage            — Family members + digest sharing
├── PoopLogPage           — 14-day frequency chart, color pie chart, pattern insights
│
├── Modals:
│   ├── PoopModal         — 3-step wizard: Color → Consistency → Details
│   ├── FoodLogModal      — Manual entry with editable quick-picks + reaction tracking
│   ├── BarcodeScanModal  — Open Food Facts API lookup
│   ├── BottleModal       — Feed type + quick-pick amounts + −/+ stepper
│   ├── SleepStartModal   — "Start Now" or "Edit Start Time" chooser
│   ├── MedicineModal     — Quick-pick meds (now includes Multivitamin, Melatonin)
│   ├── NoteModal         — Free-text note
│   ├── TeethingModal     — Tooth selector + symptoms
│   ├── DoctorModal       — Visit date, weight, height, notes, file attachments
│   └── EditLogModal      — Edit any past log (all fields, all types)
│
└── Shared: QuickLogButton, SummaryBubble, QuickAction, SectionLabel, MacroBox
```

### Theming

8 themes + "auto" mode:
- **auto** — matches device dark/light preference (default)
- **Midnight** (dark) — deep black, coral accent
- **Ocean** (dark) — navy blue, cyan accent
- **Forest** (dark) — deep green, lime accent
- **Galaxy** (dark) — deep purple, violet accent
- **Blossom** (light) — warm cream, rose accent
- **Sky** (light) — light blue, blue accent
- **Lavender** (light) — soft purple, purple accent
- **Mint** (light) — soft green, green accent

### Notifications

`src/notifications.js` exports:
- `scheduleReminder(id, title, body, intervalMs)` — repeating interval
- `scheduleNapReminders(napTimes[], babyName)` — schedules once-daily alerts at specific HH:MM times
- `cancelNapReminders()` — clears nap timers
- `syncReminders(data, reminders)` — called from App.jsx on any reminder setting change
- `cancelAllReminders()` — cleanup on unmount

### Food Quick Picks

Default quick picks are stored in `DEFAULT_QUICK_FOODS` constant. Custom picks saved to `data.settings.foodQuickPicks`. Users can add/remove/reset from the FoodLogModal (tap ✏️ Edit button).

### Household Sync (Firestore Rules)

`firestore.rules` is committed to the repo. **Must be deployed to Firebase** for household join to work without "Missing permissions" errors. Deploy via:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## Key Patterns & Rules

1. **Dates** — Always use `localDateStr()`. Never `toISOString().split('T')[0]`.
2. **Emoji** — Literal emoji in JSX only. Never `\uXXXX`.
3. **Navigation** — Always `navigate()` / `navigateBack()`, never `setPage()` directly.
4. **Safe area** — All `position: fixed` bottom elements use `env(safe-area-inset-bottom, 0px)`.
5. **Firebase writes** — Always `setDoc(..., { merge: true })`.
6. **Theme** — Resolved via `resolvedThemeKey`: "auto" → dark/light based on `prefers-color-scheme`.
7. **Last name** — `getLastName(currentUser)` extracts last word of `displayName` for the header title.

---

## What's Built (v2.6.0)

- [x] Edit past logs — all types, via ✏️ in History page
- [x] New logo (Wieser W circuit board design)
- [x] App title = user's last name + clickable → home
- [x] 8 color themes (4 dark, 4 light) + auto mode
- [x] Nap reminders with custom times
- [x] Auth page white border fix (body bg matches app)
- [x] Desktop layout (full-screen bg, no white sidebars)
- [x] Auto theme (matches device preference), including on sign-in
- [x] Household join permissions fix (firestore.rules committed)
- [x] Sleep logs: hrs+mins display; Start Now / Edit Start Time
- [x] Multivitamin + Melatonin in medicine quick menu
- [x] Editable food quick picks (add/remove/reset)
- [x] Bottle modal redesigned with integrated −/+ stepper
- [x] Editable milestone completion dates (📅 button)
- [x] "Baby Co-Pilot" branding throughout
- [x] Auto-generate daily AI digest (fires silently each new day if AI key set)

---

*Last session: 2026-03-28 — Completed all 17 requested features across v2.2.0–v2.6.0. All committed to `dev`. Say "deploy" to push to `main` + Netlify.*
