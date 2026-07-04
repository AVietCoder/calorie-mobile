# CHANGELOG — AI Calorie System (handover continuation)

Date: 2026-07-03
Scope: THT-D3 (web, `web/`) + calorie-ai-mobile (React Native, `mobile/`)

---

## 1. Project audit (status per module)

| Module | Status | Notes |
|---|---|---|
| Vision (Gemini → Qwen VL fallback) | **Completed** | `web/lib/vision.js`: temp 0 + seed, guided JSON schema, per-item counting (`items[]`) with totals computed in code, portion-from-image rules, Vietnamese-dish disambiguation |
| Nutrition Engine | **Completed** (was: partially wired) | `web/lib/nutrition.js`: unit parsing → anchor per 100 g/ml or per unit (USDA FDC → OpenFoodFacts → VN reference → AI temp 0) → cached (`nutrition_anchors` + memory) → linear scaling → Atwater validation. **Was only used by Plan; now also used by Chat (see fixes)** |
| Food / Quantity Parser | **Completed + extended** | Fractions, English words, bare counts (see BUG 2) |
| Chat | **Completed after fix** | Was generating nutrition directly from the LLM at temp 0.2 (nondeterministic, unvalidated on the analyze path) |
| Plan (coach-dynamic) | **Completed** | create / update_plan / estimate_food / health_check flows all use the shared engine |
| Weekly Health Check | **Completed** | `action: "health_check"` + web `diet-details.js` + mobile `DietScreen` |
| Charts | **Completed** | web `diet-details` + mobile `components/Charts.js` |
| Notifications / Reminders | **Completed** | web `public/reminders.js`; mobile `ReminderContext` + `expo-notifications` |
| History | **Completed** | `/api/chat-history`, offline cache on mobile |
| Voice | **Completed** | web SpeechRecognition in chat; mobile `expo-speech-recognition` |
| Guide / Landing / Settings / i18n (vi+en) | **Completed** | `guide.html`, `index.html`, `setup`, `i18n.js` (web) / `src/i18n` (mobile) |
| Mobile app + sync | **Completed** | Mobile consumes the same backend APIs (`/chat`, `/coach-dynamic`, `/analyze-food`), incl. `reanalyze` flag & `lastClientMeal` — backend fixes apply to both platforms automatically |
| Backend APIs / Database (Supabase) | **Completed** | auth (refresh flow), profiles, foods, chat_history, weekly_plan, `nutrition_anchors` (migration present) |
| Caching | **Completed** | anchor cache (DB + memory), mobile AsyncStorage plan/chat caches |
| FDC integration | **Completed** | `usdaPer100()` behind `FDC_API_KEY` |
| OpenFoodFacts | **Completed** | `offPer100()` with token-match scoring |
| Vietnam dataset | **Partially completed** | Built-in deterministic reference table (`REFERENCE_PER100`/`REFERENCE_UNITS`, ~8 staples) + `foods` DB accumulation; a full VN food-composition table is still a TODO |
| RAG knowledge base (disease diets) | **Completed** | 6 PDF sources ingested → `knowledge/knowledge-base.json`, retrieval wired into chat/plan/health-check |
| Build scripts | **Completed** | `scripts/ingest-knowledge.mjs`, `build-knowledge-base.py`, **new** `scripts/test-nutrition.mjs` |

Previous-AI claims (Guide, Landing, i18n, Notifications, Voice, Snapshot Intake, Weekly Health Check, Weekly Charts, Chat improvements, Portion detection, Vision prompt improvements, Confidence, Mobile sync, Layout fixes, DB override guard, Reset forms): **all verified present and working**, except:
- *Database Override Guard* — **partially working** (guarded odd portions, but plan saves still overwrote `foods` rows → fixed below).
- *Better Portion Detection* — **needed improvement** in the text parser (fractions/English → fixed below).

---

## 2. Bugs found, root causes, fixes

### BUG 1 — Same food gives different nutrition on every press
**Root causes**
1. Chat text paths (`api/chat.js` analyze/coach) asked the LLM to invent `calories/protein/...` at `temperature 0.2` with **no seed** and **never called the shared nutrition engine**. The analyze path additionally returned mealData **without any validation**.
2. `saveFoodRecord()` **overwrote** existing `foods` rows with the newest LLM numbers on every plan save / vision result → the "reference" DB itself drifted between calls.
3. Fuzzy `includes()` matching against the foods DB let one dish borrow another dish's numbers ("Sushi cá hồi" ↔ "Sushi").

**Fixes** (`web/api/chat.js`, `web/api/analyze-food.js`)
- Every Chat `mealData` (analyze + coach) now goes through **the same engine as Plan**: `resolveNutrition()` → quantity parse → cached anchor (USDA → OFF → VN ref → AI temp 0/seed 42) → linear scale → Atwater. The LLM only *identifies* dish + amount; the engine computes the numbers. Engine miss → old behavior (validated LLM numbers).
- Analyze completion now runs at `temperature 0, top_p 1, seed 42`.
- `saveFoodRecord()` is **insert-only** — existing `foods` rows are never overwritten.
- Foods-DB matching is **exact after normalization** (accent-stripped) in both `chat.js` (image path) and `analyze-food.js`; two-way `includes()` removed.

### BUG 2 — Poor portion estimation
**Root cause** — `parseQuantity()` didn't understand fractions (`1/2`, `1/3`), English quantity words (`half`, `three`, `one third`), unit plurals (`cups`, `glasses`, `liters`), or `"1 sushi"` (bare numbers required qty ≥ 2, so "1 sushi" fell into the **full-serving** lookup — a single piece could get whole-platter calories).

**Fixes** (`web/lib/nutrition.js`)
- Word-fraction preprocessing (EN + VI): `half`, `one third`, `two thirds`, `quarter(s)`, `một phần ba/tư` (with a guard so "một phần **ba chỉ**" = 1 serving of pork belly, not ⅓).
- Numeric fractions `a/b`, number words `một…mười` / `one…ten` / `a|an` when unit-adjacent (dish names like "ba rọi", "chè 3 màu" still parse as names — regression-tested).
- Bare leading quantity now accepts `1` and fractions → "1 sushi" = 1 **piece** (~50 kcal), "half banana" = 0.5 piece.
- Unit plurals: `cups|glass(es)`, `liter(s)|litre(s)`.
- Reference-table ordering fixed: generic milk (60 kcal/100 ml) now takes precedence over chocolate milk (80) for plain "sữa"/"milk" queries.

### BUG 3 — Conversation context corrupts new image analyses ("sushi → cookies")
**Verified already fixed** by the previous AI on both platforms: new images are analyzed with a **clean context** (system + image + current note only); conversation history is injected **only** when the client sets the `reanalyze=1` flag (resending the *same* photo with a correction). `lastClientMeal` keeps server "latest meal" in sync with what the user sees. Confirmed in `web/public/chat.js`, `mobile/src/screens/ChatScreen.js`, `web/api/chat.js`. The exact-match DB fix above also removes a residual cross-dish contamination channel.

### BUG 4 — Plan estimates better than Chat
**Root cause** — Plan (`coach-dynamic.js`) used the deterministic engine; Chat didn't (duplicated, weaker logic in prompts).
**Fix** — Chat and Plan now share **one pipeline**: vision prompt (`lib/vision.js`), quantity parser + nutrition engine + validation + confidence (`lib/nutrition.js`), food DB lookup and unit conversion. Chat prompts now ask the LLM for `description` (clean dish name) + `amount` (exact user-stated quantity) and defer numbers to the engine.

### Minor fixes
- `formatDate()` in `api/chat.js` no longer renders `NaN/NaN/NaN` for non-ISO day texts ("thứ 2").
- `<data>` tag now carries the computed `amount` (clients ignore unknown fields — safe, enables portion display later).

---

## 3. Verification
- **Web**: `node --check` passes for all `api/`, `lib/`, `public/`, `lib/rag/` files.
- **Mobile**: all 29 source files parse (Babel/JSX); **production Metro bundle succeeds** (`npx expo export --platform android` → 4.8 MB Hermes bundle, exit 0).
- **New regression suite** `web/scripts/test-nutrition.mjs` (offline — no network/API keys needed): **48/48 pass**, covering:
  - milk 100/200/300/500 ml → exactly linear & monotonic (100 ml = 60 kcal)
  - 1/2/3 sushi → 50/100/150 kcal (per piece, never whole-platter)
  - 1/2 bananas, half banana; nửa tô / 1 tô phở (VI) = half/1 bowl pho (EN) → 240/480 kcal
  - 1 phần cơm tấm = 650 kcal; 150 g cơm trắng ≈ 195 kcal; one-third cup milk ≈ 50 kcal
  - determinism: 3 repeated calls per dish → byte-identical results
  - parser guards: "chè 3 màu", "ba rọi kho tiêu", "một phần ba chỉ" not misparsed
  - Atwater correction + negative clamping

Run with: `cd web && node scripts/test-nutrition.mjs`

---

## 4. Files modified / added
| File | Change |
|---|---|
| `web/lib/nutrition.js` | Quantity parser: fractions, EN/VI number words, unit plurals, bare qty ≥ 1; reference-table ordering (milk) |
| `web/api/chat.js` | Unified nutrition pipeline for all mealData; deterministic sampling on analyze path; insert-only `saveFoodRecord`; exact-match DB lookup; `amount` in prompts & `<data>`; date guard |
| `web/api/analyze-food.js` | Exact-match (normalized) foods-DB lookup only |
| `web/scripts/test-nutrition.mjs` | **New** offline regression suite (48 tests) |
| `CHANGELOG.md` | This file |

No mobile source changes were required — mobile consumes the fixed backend.

---

## 5. Completion estimate & remaining TODOs
**Overall completion: ~92%.** All listed modules implemented; core pipelines unified and deterministic.

Remaining TODOs / suggestions:
1. **Vietnam dataset**: import a real VN food-composition table (e.g. FCT Vietnam) into `nutrition_anchors`/`foods` instead of the small built-in reference list.
2. Route the **image path's** per-item counts through the anchor cache too (currently vision computes totals from counted items; anchoring `calories_per_unit` per item name would make photo results as stable as text results across model updates).
3. `estimateOneFoodAI` in `coach-dynamic.js` is a legacy fallback that duplicates the anchor prompt; it only runs when the whole engine fails — consider removing once the engine has proven itself in production.
4. Add CI (GitHub Actions) running `node --check` + `scripts/test-nutrition.mjs` + Babel parse of mobile.
5. Consider server-side rate limiting on `/api/chat` and image size caps (client already resizes to ~2 MP).
6. Migrations `migrations/nutrition_anchors.sql` and `migrations/admin.sql` must be applied on Supabase for full caching benefit (engine degrades gracefully to memory cache without them).
