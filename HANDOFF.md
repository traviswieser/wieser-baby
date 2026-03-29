# HANDOFF.md — Wieser Baby

> **Last updated:** v2.8.0 · 2026-03-29
> Read this before every dev session. Cross-reference `wieser-baby-lessons-learned.md` for hard-won rules from prior Wieser apps.

---

## Project Overview

**Wieser Baby** is a React PWA for tracking baby/toddler daily care — feeding, sleep, diapers, poop health, food & nutrition, milestones, growth, and AI-generated daily digests. Built for one-handed operation at 2 AM with massive buttons, true dark mode, and zero friction logging.

| Detail | Value |
|--------|-------|
| Repo | `github.com/traviswieser/wieser-baby` |
| Current version | 2.8.0 |
| Framework | React (functional components + hooks) |
| App entry | `src/App.jsx` (~2100 lines) |
| Firebase | `src/firebase.js` — Firestore + Auth + household helpers |
| Auth | `src/AuthScreen.jsx` — Google + email sign-in page |
| Household | `src/HouseholdSync.jsx` — partner sync UI |
| Notifications | `src/notifications.js` — feeding, medicine, nap schedulers |
| Barcode | `src/BarcodeScanner.jsx` — camera scanner |
| Doc upload | `src/DocUpload.jsx` — file attach/preview |
| Charting | Recharts (BarChart, AreaChart, LineChart, PieChart) |
| Fonts | Nunito (body) + Fredoka (headings) via Google Fonts |
| Deployment | Netlify (production), GitHub Pages (dev preview) |
| Branch | `dev` (active work), `main` (deploy-only) |

---

## Git Workflow

**Always work on `dev`.** Never push directly to `main`.

```bash
git config user.email "travis@wieserbaby.app"
git config user.name "Travis Wieser"

# Normal workflow
git checkout dev
git add -A && git commit -m "vX.X.X: description"
git push origin dev
git remote set-url origin https://github.com/traviswieser/wieser-baby.git

# Deploy (ONLY when Travis says "deploy")
git checkout main && git pull origin main --rebase && git merge dev && git push origin main && git checkout dev
```

---

## Commit History (recent)

| SHA | Version | Description |
|-----|---------|-------------|
| `505fa62` | v2.2.0 | New logo, desktop layout, auto theme, last-name title, 4 new themes, Baby Co-Pilot |
| `f6a3679` | v2.3.0 | Household firestore.rules, Multivitamin in meds, bottle stepper, sleep hrs/mins, Sleep Start/End modals |
| `cb723a8` | v2.4.0 | Edit past logs for all types via ✏️ in History |
| `3af714a` | v2.5.0 | Editable food quick picks, editable milestone dates, nap reminders with custom times |
| `727703c` | v2.6.0 | Auto-generate daily AI digest, improved Baby Co-Pilot |
| `0848127` | v2.7.0 | AI provider step-by-step key setup guides, show/hide key toggle |
| `bdf523a` | — | Swap Diaper/Poop buttons on homepage |
| `093b68f` | — | Combined diaper logging (pee+poop), alsoWet toggle in poop wizard |
| `0fb16a1` | — | Data Import/Merge tool in Settings |
| Various | — | timeAgo fixes, isPast future-log filtering, poop text colors, sleep edit fields |
| `f53f0b3` | v2.8.0 | PWA sign-in tip, Google auth improvements |

---

## Architecture

### Component Map

```
WieserBabyApp (root)
├── DashboardPage         — 4 big buttons (Bottle/Sleep/Diaper/Food) + quick actions + summary
├── TrendsPage            — 7-day charts: feeding, diapers, sleep, food calories
├── FoodPage              — Today (macros + edit/delete), Weekly, Likes & Dislikes, All Foods
├── MilestonesPage        — 5 categories, editable completion dates
├── CoPilotPage           — Auto-daily digest, insights, history tabs
├── SettingsPage          — Baby profile, themes, AI provider, notifications, data
├── GrowthPage            — Weight/height/head + line chart
├── HistoryPage           — Date picker + type filter, ✏️ edit + ✕ delete per log
├── ActivitiesPage        — Age-filtered developmental activities
├── FamilyPage            — Family members + digest sharing
├── PoopLogPage           — 14-day frequency, color pie chart, pattern insights
│
├── Modals:
│   ├── DiaperModal       — Pee/poop toggles, log combined diaper
│   ├── PoopModal         — 3-step wizard + "Also wet?" toggle on step 3
│   ├── FoodLogModal      — Editable quick picks (solids+liquids), serving scales macros
│   ├── BarcodeScanModal  — Open Food Facts API
│   ├── BottleModal       — Feed type + −/+ stepper (auto-logs to food tracker)
│   ├── SleepStartModal   — Start Now / Edit Start Time
│   ├── SleepEndModal     — End Now / Edit End Time
│   ├── MedicineModal     — Quick-pick meds incl. Multivitamin, Melatonin
│   ├── NoteModal         — Free-text note
│   ├── TeethingModal     — Tooth selector + symptoms
│   ├── DoctorModal       — Visit date, weight, height, notes, attachments
│   └── EditLogModal      — Edit any past log (all fields, all types)
│       ├── SleepEditFields   — Start/end time pickers, auto-calculates duration
│       └── FoodEditFields    — Serving size auto-scales macros
│
└── Shared: QuickLogButton, SummaryBubble, QuickAction, SectionLabel, MacroBox
    DataSection, AIProviderSection, NotifToggleRow, NotifTimesList
```

### Theming

8 themes + "auto" mode (default). Theme is **per-user in localStorage**, never synced to Firestore:
- `THEME_LS_KEY = (uid) => \`wieser-baby-theme-\${uid}\``
- Dark: Midnight, Ocean, Forest, Galaxy
- Light: Blossom, Sky, Lavender, Mint

### Notifications (`src/notifications.js`)

- `syncReminders(data, reminders)` — called on any reminder change
- `scheduleNapReminders(times[], babyName)` — daily alerts at HH:MM
- `scheduleMedicineReminders(times[], babyName)` — same pattern
- `cancelNapReminders()` / `cancelMedicineReminders()` / `cancelAllReminders()`
- `setRemindersRef(r)` — keeps DND config fresh for all notification checks
- DND: `isDndActive(reminders)` checks current time against `dndStart`/`dndEnd`, handles overnight ranges

### Data Model

All app data stored as single JSON blob in Firestore:
- **Solo:** `users/{uid}/data/main`
- **Household:** `households/{householdId}/data/main`

Active path determined at runtime via `localStorage` key `wieser-baby-household-{uid}`.

### Key Data Fields

```javascript
{
  baby: { name, birthDate, photo },
  babies: [{ id, name, birthDate, photo }],
  activeBabyId: "baby_1",
  logs: [{ id, type, date, time, timestamp, babyId, ...typeFields }],
  milestones: { "motor_Rolls over": "2026-03-15" },
  growthRecords: [{ id, date, weight, height, head }],
  settings: {
    aiProvider, aiKey, familyMembers,
    foodQuickPicks: [...],   // user-customized quick picks
  },
  familyUpdates: [{ id, text, date, timestamp }],
  sleepState: null | { startTime: ISO },
  pediatricianNotes: [...],
  foodPreferences: { likes: [], dislikes: [] },
}
```

### Bottle → Food Auto-Log

`BOTTLE_NUTRITION_PER_OZ` lookup table. "milk" type = whole milk (18 cal/oz). Every bottle log automatically creates a matching food log with `source: "bottle"`.

### Food Serving Size Scaling

`parseServingNum(str)` parses "2 cups", "1/2", "1 1/2 oz" etc. into a number. Both `FoodLogModal` (new logs) and `FoodEditFields` (edits) auto-scale all 6 macros when serving size changes.

### Time-Since Labels (Home Buttons)

`logActualTime(l)` uses `date+time` fields, not `timestamp`. `isPast(l)` filters out future-dated logs. `lastSleep` searches ALL logs (not just today) filtered to `subtype === "woke_up"`.

---

## Key Patterns & Rules

1. **Dates** — Always `localDateStr()`. Never `toISOString().split('T')[0]`.
2. **Emoji** — Literal in JSX only. Never `\uXXXX`.
3. **Navigation** — Always `navigate()` / `navigateBack()`, never `setPage()` directly.
4. **Firebase writes** — Always `setDoc(..., { merge: true })`.
5. **Theme** — Per-user localStorage, never Firestore. `getUserTheme(uid)` / `setUserTheme(uid, t)`.
6. **Large JSX edits** — Use Python `str.replace()` scripts, not direct str_replace on large blocks.
7. **DEFAULT_QUICK_FOODS** — Defined outside `FoodLogModal` to avoid scoping issues.
8. **Icon paths** — Always `` `${import.meta.env.BASE_URL}icon-1024.png` `` (not hardcoded `/`).
9. **Firestore rules** — `firestore.rules` committed to repo. Deploy with `firebase deploy --only firestore:rules` to fix household join permissions.

---

## What's Built (v2.8.0)

- [x] Edit/delete past logs — all types, History page + Food page
- [x] New Wieser W logo (lossless PNG, 1024px for crisp display)
- [x] App title = user's last name, clickable → home
- [x] 8 color themes (4 dark, 4 light) + auto mode — per-user, not synced
- [x] Nap + medicine reminders with custom times
- [x] Do Not Disturb quiet hours
- [x] Desktop layout (full-screen bg, no white sidebars)
- [x] Household join permissions (firestore.rules)
- [x] Sleep logs: hrs+mins display; Start Now/Edit Start Time; End Now/Edit End Time
- [x] Sleep edit: start + end time pickers with auto-calculated duration
- [x] Multivitamin + Melatonin in medicine menu
- [x] Editable food quick picks (add/remove/reset, grouped solids/liquids)
- [x] Bottle modal: −/+ stepper, auto-logs to food tracker with nutrition facts
- [x] Food serving size auto-scales macros (logging + editing)
- [x] Edit/delete food logs from Food page
- [x] Editable milestone completion dates
- [x] Baby Co-Pilot (renamed), auto-generates daily digest
- [x] Combined diaper logging (pee+poop), big Diaper button on home
- [x] Home buttons show time-since-last-log (using actual log time, not entry timestamp)
- [x] Data Import/Merge tool (transfer from another device)
- [x] Splash screen matches user theme
- [x] Sign-in page shows real logo

## Open Issues / Ideas for Future Development

- [ ] **Google sign-in in installed PWA** — Works fine in browser. When installed as PWA (standalone mode), Google OAuth redirect loses its session token. Current workaround: sign in via browser URL, which shares the auth session with the installed PWA. Other Wieser apps (Workouts, Eats) reportedly don't have this issue — worth comparing their auth setup.
- [ ] Firebase Storage for large files (current base64 in Firestore capped ~900KB)
- [ ] Background push notifications (needs VAPID server)
- [ ] Export to PDF growth report
- [ ] Household member removal by admin

---

*Last session: 2026-03-29 — Built v2.2.0–v2.8.0. All committed. Say "deploy" to push to main + Netlify.*
