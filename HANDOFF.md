# RANRoute Everywhere — Full Project Handoff
**IBM AI Builders Challenge — Wildcard Track**
**For the next agent picking this up — read this entire file before touching anything.**

---

## 1. What This Project Is

**RANRoute Everywhere** is a full-stack AI-powered delivery route optimization web app built for the IBM AI Builders Challenge (Wildcard Track). The target user is a solo dispatcher or small-fleet delivery business owner who needs to plan daily routes through plain-English instructions — no GPS fleet, no ops team required.

**Core workflow:**
1. Add customers (manual, Excel/CSV import, or AI text extraction)
2. Plan a route — type a plain-English constraint like *"Get to the bakery first, pharmacy before 3pm"*
3. IBM Granite interprets the constraint → OR-Tools optimizes the stop order → Google Maps previews the route
4. Save the route as a template, reuse it on future days

**GitHub repo:** `https://github.com/MohdAbid05/RANRoute`

---

## 2. What Is Complete

Every feature is fully implemented and tested end-to-end:

| Feature | Status |
|---|---|
| Supabase Auth (sign up / sign in / forgot password / logout) | ✅ Done |
| Profile setup modal (display name, company, logo) | ✅ Done |
| Customer CRUD (create, read, update, delete) with RLS | ✅ Done |
| Duplicate detection (phone / email / address) | ✅ Done |
| Loading skeletons + toast notifications everywhere | ✅ Done |
| Excel/CSV 3-step import (drag-drop → column mapping → confirm) | ✅ Done |
| Background Nominatim geocoding with fallback variants | ✅ Done |
| Orange "Unverified" chip + inline address editor | ✅ Done |
| AI Sort — IBM Granite extraction agent | ✅ Done |
| Address normalizer — second Granite pass after extraction | ✅ Done |
| AISort 3-bucket UI (Ready / Needs Review / Could not read) | ✅ Done |
| Set Routes — DB-backed CRUD with day toggles + delete | ✅ Done |
| "Load into routing" pre-populates PlanRoutesPage | ✅ Done |
| PlanRoutesPage — 3-step stepper | ✅ Done |
| Personalization Agent — IBM Granite constraint extraction | ✅ Done |
| OR-Tools TSP solver with time windows + priority stops | ✅ Done |
| Google Maps Distance Matrix API wrapper | ✅ Done |
| Savings banner per route + cumulative on home dashboard | ✅ Done |
| Agent reasoning panel (purple card) | ✅ Done |
| Agent notes card (teal card — honesty when AI can't satisfy something) | ✅ Done |
| Google Maps JS polyline preview + numbered markers | ✅ Done |
| Start Route — deep link (≤10 stops) / modal (>10 stops) | ✅ Done |
| route_runs table + stats endpoint | ✅ Done |
| Seed script (14 Toronto demo customers + 1 saved route) | ✅ Done |
| All docs (architecture, demo-script, bob-usage) | ✅ Done |
| Test data (TEST_CASES.md + 2 CSV files) | ✅ Done |
| README fully written for GitHub | ✅ Done |
| All "RouteOne" renamed to "RANRoute Everywhere" | ✅ Done |
| .gitignore, .env.example files | ✅ Done |

---

## 3. What Still Needs Doing (Git Push)

The ONLY remaining task is the git push. `git add .` was already run — 44 files are staged.

```bash
# Run from workspace root: c:\Users\Lenovo\.bob\playground
git commit -m "RANRoute Everywhere — IBM AI Builders Challenge submission"
git remote add origin https://github.com/MohdAbid05/RANRoute.git
git branch -M main
git push -u origin main
```

> **Note:** If the remote already exists from a previous attempt, use:
> `git remote set-url origin https://github.com/MohdAbid05/RANRoute.git`
> then push.

---

## 4. Project Structure

```
c:\Users\Lenovo\.bob\playground\          ← workspace root (also git root)
│
├── frontend/
│   ├── index.html                         browser tab title "RANRoute Everywhere"
│   ├── package.json                       name: "ranroute-everywhere"
│   ├── .env.example                       VITE_ keys (safe to commit)
│   └── src/
│       ├── App.jsx                        entire UI ~1800 lines (all components here)
│       ├── api.js                         all backend fetch calls with JWT injection
│       ├── supabase.js                    Supabase client singleton (anon key)
│       ├── styles.css                     full dark theme ~1750 lines
│       └── main.jsx                       React entry point (ReactDOM.createRoot)
│
├── backend/
│   ├── main.py                            FastAPI app, 5 routers registered
│   ├── auth.py                            get_current_user JWT dependency
│   ├── database.py                        Supabase singleton client (service key)
│   ├── seed.py                            14 Toronto demo customers + 1 saved route
│   ├── requirements.txt                   all Python deps
│   ├── .env.example                       all keys as placeholders
│   ├── agents/
│   │   ├── base.py                        GraniteAgent class (shared by all 3 agents)
│   │   ├── extraction_agent.py            Agent 1 — extracts records from raw text
│   │   ├── address_normalizer.py          Agent 2 — normalizes addresses post-extraction
│   │   └── personalization_agent.py       Agent 3 — constraints from plain English
│   ├── routers/
│   │   ├── customers.py                   CRUD + import-preview + import-confirm
│   │   ├── agents.py                      extract-customers + personalize-route + normalize
│   │   ├── set_routes.py                  saved route CRUD
│   │   ├── solver.py                      POST /solver/optimize (+ saves route_run)
│   │   └── route_runs.py                  GET /route-runs/stats
│   ├── solver/
│   │   ├── route_solver.py                OR-Tools TSP with time windows + priorities
│   │   └── distance_matrix.py             Google Maps Distance Matrix + Geocoding API
│   ├── utils/
│   │   └── geocoding.py                   Nominatim with fallback variants, 1 req/s
│   ├── models/
│   │   └── customer.py                    CustomerCreate, CustomerUpdate, CustomerOut
│   └── sql/
│       └── schema.sql                     customers + set_routes + route_runs + RLS
│
├── docs/
│   ├── architecture.md
│   ├── demo-script.md
│   └── bob-usage.md
│
├── test-data/
│   ├── TEST_CASES.md                      5-test demo walkthrough, paste-ready content
│   ├── customers_clean.csv                5 clean Toronto customers for import test
│   └── customers_bad_addresses.csv        5 badly formatted addresses for normalizer demo
│
├── _workspace/                            gitignored — old chat history, guides
├── .gitignore
├── README.md
├── PLAN.md
└── HANDOFF.md                             ← this file
```

---

## 5. Environment Variables

### Backend — `backend/.env` (never committed)
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>          ← the long secret key (backend-only!)
WATSONX_API_KEY=<ibm_cloud_api_key>
WATSONX_PROJECT_ID=<watsonx_project_uuid>
WATSONX_URL=https://ca-tor.ml.cloud.ibm.com      ← Toronto region (user's region)
GOOGLE_MAPS_API_KEY=<key>
EXTRACTION_CONFIDENCE_THRESHOLD=0.7
SEED_USER_ID=<supabase_auth_user_uuid>           ← only needed for seed.py
```

### Frontend — `frontend/.env` (never committed)
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>                ← safe in frontend (RLS enforces access)
VITE_GOOGLE_MAPS_KEY=<key>
VITE_API_URL=http://localhost:8000
```

### Critical Notes on Keys
- `WATSONX_URL` is `https://ca-tor.ml.cloud.ibm.com` — user is in Toronto region, NOT us-south
- The watsonx project MUST have a Watson Machine Learning instance associated (user already fixed this in IBM Cloud console)
- Google Cloud project needs: **Maps JavaScript API**, **Distance Matrix API**, **Geocoding API** all enabled (user already enabled these)
- `SUPABASE_SERVICE_KEY` must NEVER go to the frontend — it bypasses RLS

---

## 6. How to Run Locally

```bash
# Terminal 1 — Backend
cd backend
# .venv lives at workspace root, not inside /backend
..\.venv\Scripts\activate          # Windows PowerShell
uvicorn main:app --reload          # http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm run dev                        # http://localhost:5173
```

If `.venv` doesn't exist yet:
```bash
# from workspace root
python -m venv .venv
.venv\Scripts\activate
cd backend
pip install -r requirements.txt
```

Database setup (run once in Supabase SQL Editor):
```sql
-- paste contents of backend/sql/schema.sql
```

---

## 7. Detailed File Descriptions

### `backend/main.py`
FastAPI app entry point. Loads `.env` via `python-dotenv`, registers 5 routers with their URL prefixes, adds CORS middleware allowing `localhost:5173`. Has a `/health` endpoint. Nothing complex — just wiring.

### `backend/auth.py`
FastAPI dependency `get_current_user`. Uses the Supabase service key to call `supabase.auth.get_user(token)` to verify JWTs. Returns the Supabase user object. Raises HTTP 401 on invalid/expired tokens. Used as `Depends(get_current_user)` on every protected route.

### `backend/database.py`
Singleton Supabase client using the service key. The `get_db()` function returns the same client instance every call — never opens a new connection per request. Service key allows the backend to write/read on behalf of any user without being blocked by RLS (RLS is still applied through the scoped `.eq("user_id", user.id)` queries we write manually).

### `backend/agents/base.py` — `GraniteAgent`
Wrapper around `ibm_watsonx_ai.foundation_models.ModelInference`.
- Model: `ibm/granite-3-8b-instruct` (hard-coded default, overridable)
- Temperature: `0.0` for deterministic JSON output
- Max tokens: `2048`
- `call(user_message, retries=3)` — sends chat messages, strips markdown code fences from response, parses JSON. Retries up to 3 times on `json.JSONDecodeError`. Raises `RuntimeError` on API failure, `ValueError` after all retries exhausted.

### `backend/agents/extraction_agent.py`
**Agent 1 — IBM Granite Extraction Agent.**
System prompt instructs Granite to extract customer records from unstructured text and return:
```json
{
  "records": [{ "name", "address", "phone", "email", "contact", "confidence" }],
  "unreadable": ["snippet that couldn't be parsed"]
}
```
- Confidence 0–1; < 0.7 = uncertain
- `extract_customers(raw_text)` validates the shape, clamps confidence to 0–1, then immediately calls `normalize_addresses()` as a second pass
- Adds `address_normalized`, `address_changed`, `address_note` to each record

### `backend/agents/address_normalizer.py`
**Agent 2 — IBM Granite Address Normalizer.**
System prompt: given raw text context + a list of addresses, return a JSON array of `{ original, normalized, changed, note }`. Uses geographic clues from the raw text (city names, regions) to complete partial addresses. Never invents street numbers or postal codes.
- Called automatically after extraction (via `extraction_agent.py`)
- Also exposed as standalone `POST /agents/normalize-addresses` for fixing individual customer addresses
- Always falls back gracefully — if the agent fails, returns addresses unchanged (never crashes the caller)

### `backend/agents/personalization_agent.py`
**Agent 3 — IBM Granite Personalization Agent.**
System prompt: given a customer list `[{id, name}]` + a plain-English instruction, return:
```json
{
  "priority_stops": ["uuid1", "uuid2"],
  "time_windows": [{ "customer_id": "uuid", "before": "15:00", "after": null }],
  "agent_notes": "null OR (what failed + specific alternative)"
}
```
- LLM receives ONLY `{id, name}` — never addresses or coordinates
- After the call, `personalize_route()` strips any IDs not in the submitted customer list (hallucination guard)
- `agent_notes` rule: must be `null` if everything is satisfied, OR must contain both (a) what it couldn't do AND (b) a specific actionable alternative — never vague

### `backend/routers/customers.py`
Five endpoints, all scoped to the authenticated user:

| Endpoint | Purpose |
|---|---|
| `GET /customers` | List all customers ordered by created_at desc |
| `POST /customers` | Create customer, check duplicates (phone/email/address), geocode in background |
| `PUT /customers/{id}` | Update customer; if address changes, re-geocode synchronously |
| `DELETE /customers/{id}` | Delete customer (ownership check) |
| `POST /customers/import-preview` | Parse Excel/CSV, auto-detect column mapping, return preview rows |
| `POST /customers/import-confirm` | Insert rows with duplicate detection, queue background geocoding |

Column auto-detection uses an alias map: e.g. "business", "company", "client" → `name` field.

### `backend/routers/agents.py`
Three endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /agents/extract-customers` | 20k char limit, calls `extract_customers()` → returns records + unreadable |
| `POST /agents/personalize-route` | Strips fields beyond `{id, name}` before LLM call, returns constraint set |
| `POST /agents/normalize-addresses` | Standalone normalizer for fixing existing customer addresses |

### `backend/routers/set_routes.py`
Full CRUD for saved route templates:
- `GET /set-routes` — list all for user
- `POST /set-routes` — create (name, customer_ids, last_constraints JSONB, recurrence string)
- `PUT /set-routes/{id}` — update any field (used for day-toggle recurrence updates)
- `DELETE /set-routes/{id}` — delete with ownership check

`recurrence` is stored as a plain string, e.g. `"weekly:mon,wed,fri"`. Parsed by the frontend.

### `backend/routers/solver.py`
`POST /solver/optimize` — the main optimization endpoint.
1. Validates customer_ids (max 25, not empty), depot_address (not blank)
2. Calls `optimize_route()` from `route_solver.py`
3. On success, inserts a row into `route_runs` (never blocks the response if this fails)
4. Returns the full result dict from the solver

### `backend/routers/route_runs.py`
`GET /route-runs/stats` — aggregates all saved route_runs for the user:
- `total_runs` — number of routes ever optimized
- `total_time_saved_s` — sum of `(naive_duration_s - total_duration_s)` across all runs
- `total_dist_saved_m` — sum of `(naive_distance_m - total_distance_m)` across all runs

Displayed on the home dashboard as the cumulative savings counter.

### `backend/solver/route_solver.py`
The OR-Tools TSP solver. Full pipeline:
1. Geocode depot via Google Maps Geocoding API (fallback to Nominatim)
2. Fetch customer `lat/lon` from Supabase (scoped by user_id)
3. Build `locations` list: depot at index 0, customers at 1..N
4. Call `get_distance_matrix(locations)` → NxN duration and distance matrices
5. Compute naive metrics (depot→c0→c1→…→cN in original order) for savings banner
6. Build OR-Tools `RoutingModel`:
   - Duration callback registered as arc cost
   - Time dimension added with 24h horizon
   - Hard time windows via `CumulVar.SetRange(after_s, before_s)`
   - Priority stops via `AddDisjunction` with penalty=0 (must-visit, hard)
   - Search: `PATH_CHEAPEST_ARC` first solution + `GUIDED_LOCAL_SEARCH` metaheuristic, 10s limit
7. If infeasible with time windows, retry without time windows (relaxation)
8. If still infeasible, raise `ValueError` naming the conflicting stops
9. Extract optimized order, compute total time/distance along the route
10. Return: `{ optimized_order, total_distance_m, total_duration_s, naive_distance_m, naive_duration_s, customers, skipped_customer_ids }`

Cap: 25 stops max (enforced at both router and solver level).

### `backend/solver/distance_matrix.py`
Two async functions:
- `geocode_address_gmaps(address)` — single-address geocoding via Google Maps Geocoding API
- `get_distance_matrix(locations)` — NxN Google Maps Distance Matrix call, `driving` mode. Returns `(duration_matrix_seconds, distance_matrix_meters)`. Unreachable pairs get penalty value `999999` so OR-Tools avoids them.

### `backend/utils/geocoding.py`
Nominatim geocoder with fallback variants.
- `geocode_address(address)` → `(lat, lon, verified: bool)`
- Generates fallback variants: apostrophe fixes (St. John's), Canada suffix, province abbreviation expansion (ON→Ontario, BC→British Columbia, etc.), unit number stripping
- 1 req/s enforced (even on first call) to comply with Nominatim ToS
- Returns `(None, None, False)` if all variants fail — never crashes

### `backend/models/customer.py`
Three Pydantic models:
- `CustomerCreate` — name + address required, others optional
- `CustomerUpdate` — all fields optional (PATCH-style)
- `CustomerOut` — full shape returned by the API including lat/lon/verified/source/created_at

### `backend/sql/schema.sql`
Three tables with RLS:

**`customers`** — `id, user_id, name, contact, phone, email, address, lat, lon, verified, source, created_at`
- `source` check constraint: `manual | excel | ai`
- RLS policy: `auth.uid() = user_id` for all operations

**`set_routes`** — `id, user_id, name, customer_ids uuid[], last_constraints jsonb, recurrence, active, created_at`
- `last_constraints` JSONB stores the full ConstraintSet from the last optimization

**`route_runs`** — `id, user_id, depot_address, customer_ids uuid[], optimized_order uuid[], constraints jsonb, total_distance_m, total_duration_s, naive_distance_m, naive_duration_s, status, created_at`
- `status` check constraint: `draft | saved | started | completed`

### `backend/seed.py`
Inserts 14 Toronto-area customers and 1 saved route (`"West Side Morning Run"`, first 8 customers, recurrence `weekly:mon,wed,fri`). Prints the demo instruction string at the end. Requires `SEED_USER_ID` in `.env` (your Supabase auth user UUID).

---

## 8. Frontend File Descriptions

### `frontend/src/main.jsx`
Standard React 18 entry point. Renders `<App />` into `#root` with `React.StrictMode`.

### `frontend/src/supabase.js`
Supabase client singleton using the anon key from `VITE_SUPABASE_ANON_KEY`. Safe to use in the frontend because RLS policies enforce ownership. Used for auth only — all data queries go through the backend.

### `frontend/src/api.js`
All backend API calls in one file. Every call uses `apiFetch()`:
- Gets the Supabase session token
- Injects `Authorization: Bearer <token>` header on every request
- Handles HTTP 409 (duplicate) specially — throws an error with `isDuplicate: true` and `fields: [...]`
- Throws `Error` with response text on any other non-OK response

Exported functions:
```
getCustomers, createCustomer, updateCustomer, deleteCustomer
importPreview(file), importConfirm(rows, mapping)
extractCustomers(raw_text)
normalizeAddresses(raw_text, addresses)
getSetRoutes, createSetRoute, updateSetRoute, deleteSetRoute
personalizeRoute(data), optimizeRoute(data), getRouteStats()
```

### `frontend/src/App.jsx`
The entire frontend UI in one file (~1800 lines). All components:

| Component | Purpose |
|---|---|
| `App` | Root — session state, page routing, profile, route stats, toast |
| `LoginScreen` | Sign in / Sign up / Forgot password via Supabase Auth |
| `ProfileSetupModal` | First-login modal — display name, company, logo (stored in localStorage) |
| `TopBar` | Navigation bar with page indicator, profile avatar, logout |
| `HomePage` | 3-card dashboard (Customers, Plan Route, Set Routes) + savings stats |
| `CustomersPage` | Manual entry + Excel import + AI Sort tabs |
| `AISort` | 3-bucket extraction UI (Ready/Needs Review/Could not read), inline edit, commit |
| `PlanRoutesPage` | 3-step route optimization stepper |
| `SetRoutesPage` | Saved routes list with day toggles, load, delete |
| `Toast` | Auto-dismissing 3-second notification |

**State flow:**
- `App` holds `customers` state and passes it down to `CustomersPage` and `PlanRoutesPage`
- `planPreload` state in `App` is set by `SetRoutesPage` → `onLoadIntoRouting` → passed to `PlanRoutesPage` as `preload` prop
- `routeStats` is fetched on mount and refreshed after every optimization via `onRouteOptimized` callback
- Profile is stored in `localStorage` under key `ranroute_profile`

### `frontend/src/styles.css`
Full dark theme (~1750 lines). Notable classes:
- `.login-page`, `.login-hero`, `.login-panel`, `.login-card` — auth screen layout
- `.app-shell`, `.top-bar`, `.page-wrap` — main app shell
- `.customer-row`, `.verified-chip`, `.unverified-chip` — customer list rows
- `.ai-sort-bucket`, `.ai-record-card` — AI Sort result buckets
- `.route-stepper`, `.stepper-step` — 3-step route planner
- `.agent-note-card` — teal card for agent_notes
- `.agent-reasoning-card` — purple card showing what Granite parsed
- `.savings-banner` — green banner showing time/distance saved
- `.stop-list`, `.stop-item` — optimized route stop list
- `.map-container` — Google Maps embed container
- `.modal-overlay`, `.modal-card` — modal dialogs
- `.toast` — notification toast

---

## 9. Data Flow Diagrams

### Route Optimization Flow
```
User clicks "Optimize route"
    │
    ├─► POST /agents/personalize-route
    │     payload: { customers: [{id, name}], instruction: "..." }
    │     ← LLM NEVER sees addresses, only {id, name}
    │     GraniteAgent (ibm/granite-3-8b-instruct)
    │     → { priority_stops: [uuid], time_windows: [{...}], agent_notes: null|"..." }
    │     Server strips any IDs not in submitted list
    │     ↓
    ├─► POST /solver/optimize
    │     1. geocode_address_gmaps(depot) → (lat, lon)
    │     2. Supabase: SELECT lat, lon FROM customers WHERE id IN [...]
    │     3. Google Maps Distance Matrix → NxN matrices
    │     4. OR-Tools RoutingModel
    │          Hard: time windows (AddDimension + CumulVar.SetRange)
    │          Soft: priority stops (AddDisjunction penalty=0)
    │          Objective: minimize total travel time
    │          10s time limit → Guided Local Search
    │     5. naive metrics (original order)
    │     6. INSERT route_runs row (non-blocking)
    │     → { optimized_order, total_*, naive_*, customers, skipped_ids }
    │     ↓
    └─► Frontend renders:
          agent_notes card (if non-null)
          savings banner
          numbered stop list
          Google Maps JS polyline
          Save / Start Route buttons
```

### AI Extraction Flow
```
User pastes text → POST /agents/extract-customers
    │
    ├─► GraniteAgent (extraction pass)
    │     → { records: [{name, address, confidence}], unreadable: [...] }
    │     ↓
    └─► GraniteAgent (address normalization pass)
          input: raw_text (as context) + addresses list
          → [{ original, normalized, changed, note }]
          merged back onto records as address_normalized, address_changed, address_note

Frontend AISort:
  confidence >= 0.7 → "Ready" bucket (green)
  confidence < 0.7  → "Needs Review" bucket (orange, inline editable)
  unreadable []     → "Could not read" bucket (grey)

User clicks "Commit" → POST /customers for each record
  → background geocoding via Nominatim
```

---

## 10. Security Model

| Rule | Implementation |
|---|---|
| All API routes require JWT | `Depends(get_current_user)` on every router function |
| All DB queries scoped to user | `.eq("user_id", user.id)` on every Supabase query |
| Supabase service key backend-only | Never in frontend env vars |
| Anon key in frontend | Safe — RLS policies enforce ownership on all tables |
| LLM never sees addresses | `personalize_route()` strips all fields except `{id, name}` before calling Granite |
| LLM IDs validated server-side | Both `personalization_agent.py` and `routers/agents.py` strip hallucinated IDs |
| Supabase RLS | All 3 tables have `auth.uid() = user_id` for all operations |

---

## 11. Known Issues / Decisions to Be Aware Of

1. **`WATSONX_URL` is Toronto region** — `https://ca-tor.ml.cloud.ibm.com`. If you change this to `us-south`, the IBM Cloud project won't be found and you'll get a 403.

2. **Google Maps API key needs 3 APIs enabled** — Maps JavaScript API, Distance Matrix API, Geocoding API. If any is missing you'll get `REQUEST_DENIED`.

3. **The `.venv` lives at workspace ROOT** — `c:\Users\Lenovo\.bob\playground\.venv`, not inside `/backend`. Activate from `/backend` with `..\.venv\Scripts\activate`.

4. **Nominatim is slow** — 1 req/s by ToS. Background geocoding for 10 imported customers takes ~10s. This is intentional — do not remove the sleep.

5. **OR-Tools priority stops** — the implementation uses `AddDisjunction` with `penalty=0` (must-visit hard constraint). This means priority stops are guaranteed to be in the route, but they're not explicitly forced to be first — OR-Tools' arc cost minimization + time window interaction tends to put them early. If "first stop" is critical for a demo, the personalization agent should also set a tight `after: "08:00"` time window.

6. **Max 25 stops** — enforced at both `routers/solver.py` and `route_solver.py`. Google Maps Distance Matrix allows 25×25 = 625 elements per request.

7. **Profile stored in localStorage** — not in the database. If the user clears localStorage, the profile setup modal will reappear. This is intentional (avoids adding a `profiles` table).

8. **AISort commits go through `POST /customers`** — the same endpoint as manual entry, with `source: "ai"` set in the record. Background geocoding runs after each commit.

9. **`agent_notes` honesty rule** — the Personalization Agent system prompt explicitly says `agent_notes` must be `null` OR must contain both (a) what failed AND (b) a specific alternative. Never vague. This is a key UX differentiator — do not weaken this.

10. **Git was initialized at workspace root** — `c:\Users\Lenovo\.bob\playground` is the git root. The `.gitignore` excludes `_workspace/`, `.venv/`, `node_modules/`, `__pycache__/`, `.env` files.

---

## 12. Demo Walkthrough (Quick Reference)

**Setup:**
- Backend: `uvicorn main:app --reload` from `/backend` (with .venv active)
- Frontend: `npm run dev` from `/frontend`
- Optional seed data: `python seed.py` from `/backend` (set `SEED_USER_ID` first)
- Sign in at `http://localhost:5173`

**5-step demo:**

1. **Home** — show 3-card layout, savings counter
2. **AI Sort** — paste the TEST 4 text block from `test-data/TEST_CASES.md`, click "Extract with AI", show 3 buckets, commit
3. **Plan Route** — depot `460 King St W, Toronto, ON M5V 1L7`, select 5 customers, paste: *"Get to Kensington Market Deli first — they need delivery before 9am. Ossington Photo Studio should be last."*
4. Show: agent notes card (explains "last" limitation), savings banner, stop list, map
5. **Set Routes** — show saved route card, toggle a day, "Load into routing"

**IBM touchpoints to name explicitly:**
- IBM Granite `ibm/granite-3-8b-instruct` on watsonx.ai for both extraction and personalization
- Two separate agents by design — different domains, each better at its job
- LLM never sees addresses — confirmed by code inspection of `personalization_agent.py`
- Server-side ID validation — hallucination guard

---

## 13. What a Next Agent Should Do First

1. **Read this file completely** (you're doing that now ✓)
2. **Check git status**: `git status` — confirm 44 files are staged, nothing unexpected
3. **Complete the push**:
   ```bash
   git commit -m "RANRoute Everywhere — IBM AI Builders Challenge submission"
   git remote add origin https://github.com/MohdAbid05/RANRoute.git
   git branch -M main
   git push -u origin main
   ```
4. **Verify the app runs end-to-end** with the backend and frontend started
5. **Run through the demo** using TEST_CASES.md test 4 + test 5 to confirm everything works

If you need to make any code changes, the most likely places are:
- `frontend/src/App.jsx` — all UI lives here
- `backend/agents/personalization_agent.py` — if tuning the constraint extraction prompt
- `backend/solver/route_solver.py` — if adjusting the solver behavior
- `backend/utils/geocoding.py` — if adding more address variant fallbacks

---

*Generated by IBM Bob — RANRoute Everywhere agent handoff*
