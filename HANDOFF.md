# HANDOFF.md — Wieser Baby

> **Last updated:** v1.1.0 · 2026-03-27
> Read this before every dev session. Cross-reference `wieser-baby-lessons-learned.md` for hard-won rules from prior Wieser apps.

---

## Project Overview

**Wieser Baby** is a React PWA for tracking baby/toddler daily care — feeding, sleep, diapers, poop health, food & nutrition, milestones, growth, and AI-generated weekly digests. Built for one-handed operation at 2 AM with massive buttons, true dark mode, and zero friction logging.

| Detail | Value |
|--------|-------|
| Repo | `github.com/traviswieser/wieser-baby` |
| Current version | 1.1.0 |
| Framework | React (functional components + hooks) |
| Single file | `src/App.jsx` (~830 lines) |
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

All data is stored as a single JSON blob under the key `"wieser-baby-data"` using the `window.storage` API.

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

---

## What's NOT Built Yet

These are planned but not yet implemented:

- [ ] **Firebase/Firestore integration** — Real-time caregiver syncing. See lessons learned for `set({merge:true})`, per-user localStorage keys with UID, and security rules guidance.
- [ ] **PWA manifest + service worker** — `manifest.json`, Apple meta tags, SW with cache versioning. Remember: Vite strips PWA tags on build — use a post-build script to re-inject them.
- [ ] **Build system** — Need to choose Vite or custom `build.js`. Target: single `index.html` with all JS/CSS inlined. Guard output paths with `fs.existsSync()` for CI.
- [ ] **Netlify deployment** — `netlify.toml` with `SECRETS_SCAN_SMART_DETECTION_ENABLED = "false"`, functions rules before SPA catch-all.
- [ ] **Camera-based barcode scanning** — Currently manual entry only. Would need a JS barcode library (e.g., `quagga2` or `zxing-js`).
- [ ] **Pediatrician document upload** — Mentioned in original spec. Would need file input + storage (Firebase Storage or base64 in Firestore).
- [ ] **Predictive sleep windows** — AI-driven, based on logged wake/sleep patterns.
- [ ] **Multi-baby support** — Switching between children in the same household.
- [ ] **Push notifications** — Feeding reminders, medication schedules.

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
│   └── App.jsx                          # The entire app (single file)
├── wieser-baby-lessons-learned.md       # Hard-won rules from Wieser Workouts + Eats
├── HANDOFF.md                           # This file
└── (future)
    ├── index.html                       # Build output
    ├── manifest.json                    # PWA manifest
    ├── sw.js                            # Service worker
    ├── netlify.toml                     # Netlify config
    └── build.js or vite.config.js       # Build system
```

---

*Last session: 2026-03-27 — Built v1.0.0 (full feature set) and v1.1.0 (poop tracking + food barcode scanner). Both committed to `dev` and pushed to GitHub.*
