# RANRoute — Build Plan

**Challenge:** IBM AI Builders Challenge — Wildcard Track
**Stack:** React (Vite) frontend · Python + FastAPI backend · Supabase (Postgres + Auth) · OR-Tools solver · watsonx.ai (IBM Granite) for both AI agents · Google Maps JS API (in-app preview) · Nominatim (geocoding)

---

## Top-Level Overview

RouteOne is a route-planning platform for solo/small-fleet delivery and service businesses. It lets a dispatcher build an optimized daily route through plain-language instructions — no GPS fleet or historical data required.

The build is split into seven self-contained sub-tasks. The existing React prototype (`src/App.jsx`) provides the full visual shell. Each sub-task wires real backend behaviour into screens that already exist.

**Four phases of product scope:**
1. **Auth + Customers Dashboard** — persistent customer records, three import paths, geocoded + verified addresses
2. **Set Routes Dashboard** — saved reusable route templates backed by Postgres
3. **Routing Dashboard** — OR-Tools solver + natural-language personalization agent + Google Maps in-app preview
4. **Polish & Submission Readiness** — demo data, savings comparison, IBM writeup

---

## Key Architecture Decisions (locked before implementation)

| Decision | Choice | Reason |
|---|---|---|
| Auth | Supabase Auth (email/password) | Free tier, built-in JWT, no custom token flow |
| Database | Supabase Postgres | Free tier, RLS policies, pairs with Auth |
| Geocoding | Nominatim (OpenStreetMap) | Free, no key required; called at import time only with 1s delay |
| Distance matrix | Google Maps Distance Matrix API | More reliable than public OSRM for a live demo; free tier covers 25-stop demo |
| Map preview | Google Maps JavaScript API | Premium look in-app; deep link fallback for Start Route |
| AI agents | watsonx.ai (IBM Granite) via FastAPI backend | Explicit IBM technology touchpoint; no LLM calls from frontend |
| Route solver | OR-Tools (Python) | Proven, free, handles time windows and soft penalties |
| Solver stop cap | 25 stops | Keeps Distance Matrix calls and solve time predictable for judged demo |
| Google Maps deep link | Max 10 waypoints per Google limit | For >10 stops: show ordered list; offer deep link for first 10 |
| Agent honesty | Agent explicitly states when it cannot satisfy a constraint and proposes an alternative | Core UX differentiator — never silently fail or hallucinate a workaround |

---

## Data Model

```
Customer {
  id: uuid PK
  user_id: uuid FK → auth.users
  name: string
  phone: string | null
  email: string | null
  address: string
  lat: float | null
  lon: float | null
  verified: boolean
  source: "manual" | "excel" | "ai"
  created_at: datetime
}

SetRoute {
  id: uuid PK
  user_id: uuid FK → auth.users
  name: string
  customer_ids: uuid[]
  last_constraints: ConstraintSet | null   (stored as JSONB)
  recurrence: string | null                (e.g. "weekly:mon,wed,fri")
  created_at: datetime
}

ConstraintSet {
  priority_stops: uuid[]
  time_windows: [{ customer_id: uuid, before: "HH:MM" | null, after: "HH:MM" | null }]
  agent_notes: string | null               (what the agent could NOT resolve — shown to user)
}

RouteRun {
  id: uuid PK
  user_id: uuid FK → auth.users
  depot_address: string
  customer_ids: uuid[]
  optimized_order: uuid[]
  constraints: ConstraintSet (JSONB)
  total_distance_m: float
  total_duration_s: float
  naive_distance_m: float                  (for savings banner)
  naive_duration_s: float
  status: "draft" | "saved" | "started" | "completed"
  created_at: datetime
}
```

---

## Sub-Task 1 — Project Scaffold & Auth

**Status:** [ ] pending

### Intent
Set up the full monorepo structure, connect the existing React frontend to a real Supabase project, and replace the hardcoded `rishi/patel` login with Supabase Auth. This is the foundation every other sub-task builds on.

### Expected Outcomes
- Repo has `/frontend` and `/backend` directories
- `npm run dev` (from `/frontend`) starts the frontend at `localhost:5173`
- `uvicorn main:app --reload` (from `/backend`) starts the API at `localhost:8000`
- A real user can sign up and log in via Supabase Auth; hardcoded credentials are gone
- The frontend sends a Supabase JWT with every API request; the backend verifies it
- All API keys and secrets live in `.env` files, never in source code
- The login screen is visually upgraded: animated gradient background, smooth form transitions

### Todo List
1. Move all existing frontend files into `/frontend`; create `/backend` with `main.py`, `requirements.txt`, `agents/`, `solver/` folders
2. Create a Supabase project; copy the project URL and anon key
3. Add `@supabase/supabase-js` to `/frontend`; add `supabase-py`, `fastapi`, `uvicorn`, `python-dotenv` to `/backend/requirements.txt`
4. Create a Supabase client singleton in `/frontend/src/supabase.js`
5. Replace `LoginScreen` in `App.jsx`: swap the hardcoded check for `supabase.auth.signInWithPassword({ email, password })`
6. Add a Sign Up flow (toggle below the login form, same card, smooth CSS transition)
7. Add a "Forgot password" link that calls `supabase.auth.resetPasswordForEmail()`
8. Add a logout handler that calls `supabase.auth.signOut()`
9. In the backend, add a `get_current_user` FastAPI dependency that extracts and verifies the Supabase JWT on every protected route
10. Create `/frontend/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_KEY`) and `/backend/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL`, `GOOGLE_MAPS_API_KEY`, `EXTRACTION_CONFIDENCE_THRESHOLD=0.7`)
11. Add both `.env` files to `.gitignore`; create `.env.example` files with placeholder values
12. Visual upgrade: add a subtle animated gradient or particle-line SVG to the login hero section; add a loading spinner on form submit

### Relevant Context
- Existing login UI: [`src/App.jsx`](src/App.jsx) — `LoginScreen` component (lines ~60–120)
- Existing app shell: [`src/App.jsx`](src/App.jsx) — `App` function, `login()`, `logout()`
- Supabase JS: `supabase.auth.signInWithPassword({ email, password })` returns `{ data, error }`
- Backend JWT verification: Supabase service key + `supabase_py` `auth.get_user(jwt)` or decode with `python-jose`

---

## Sub-Task 2 — Database Schema & Customer API

**Status:** [ ] pending

### Intent
Create the Postgres schema in Supabase and build the FastAPI CRUD endpoints for customers. This replaces in-memory React state with real persistent storage.

### Expected Outcomes
- Four tables exist in Supabase: `customers`, `set_routes`, `route_runs`
- `GET /customers`, `POST /customers`, `PUT /customers/{id}`, `DELETE /customers/{id}` all work
- The frontend `CustomersPage` reads from and writes to the real API
- Records created in one browser session appear in another after refresh
- Duplicate detection is enforced server-side on phone, email, and address

### Todo List
1. In Supabase SQL editor, create the `customers` table with all fields from the data model above
2. Create the `set_routes` table (id, user_id, name, customer_ids uuid[], last_constraints jsonb, recurrence text, created_at)
3. Create the `route_runs` table (all fields from the data model above)
4. Enable Row Level Security on all three tables; add policies: `auth.uid() = user_id` for all operations
5. In FastAPI, create `routers/customers.py` with `GET /customers`, `POST /customers`, `PUT /customers/{id}`, `DELETE /customers/{id}` — all scoped to the authenticated user
6. Add duplicate-detection in `POST /customers`: query for existing records with same phone, email, or normalized address for this user; return HTTP 409 with a clear message listing which field conflicts
7. Update `CustomersPage` in the frontend: fetch from `GET /customers` on mount (with a loading skeleton), POST on manual add, DELETE on remove; remove all `starterCustomers` hardcoded data
8. Show a toast notification on success/error for every API action (add, delete, duplicate detected)
9. Add a loading skeleton (pulsing rows) while the customer list is fetching

### Relevant Context
- Existing customer list rendering: [`src/App.jsx`](src/App.jsx) — `CustomersPage`, `customer-list` div
- Existing customer shape: `{ id, name, contact, phone, address, city }` — expand to include `email`, `lat`, `lon`, `verified`, `source`
- Supabase RLS docs: each table needs `CREATE POLICY` statements after `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

---

## Sub-Task 3 — Manual Entry & Excel Import with Geocoding

**Status:** [ ] pending

### Intent
Make Manual Entry and Excel/CSV import fully functional end-to-end, including validation, server-side geocoding at import time, and visual flagging of unverified addresses.

### Expected Outcomes
- Manual entry form validates phone format, email format, required fields (name + address) with inline error messages before submission
- Excel/CSV upload sends the file to the backend, which auto-detects column names, returns a preview table and detected mapping
- User can correct the column mapping in the UI before confirming import
- Every imported address is geocoded via Nominatim; unresolvable addresses are stored with `verified: false`
- The customer list shows an orange "Unverified" badge on any `verified: false` record with a tooltip
- Unverified customers appear greyed-out in the Routing dashboard customer selector with a "Verify address first" tooltip
- Duplicate submissions caught and surfaced as a clear warning (not silently dropped)

### Todo List
1. Add inline validation to the manual entry form: regex for phone (`^\+?[\d\s\-().]{7,15}$`), email format, required `name` and `address`; show red helper text under each invalid field
2. In FastAPI, add `geocode_address(address: str) → (lat, lon, verified: bool)` utility: calls Nominatim with `User-Agent` header, 1-second sleep, returns `(None, None, False)` on failure
3. Call `geocode_address` inside `POST /customers` after validation; store `lat`, `lon`, `verified` on the record
4. Add `POST /customers/import-excel` endpoint: accepts multipart file, parses with `openpyxl` + `pandas`, auto-detects columns by header name (case-insensitive match against `name`, `address`, `phone`, `email`), returns `{ rows: [...], detected_mapping: {...} }`
5. Replace the visual-only file picker in the Excel tab with a real upload that POSTs to `/customers/import-excel` and renders the preview table with column-mapping dropdowns
6. Each column-mapping dropdown lets the user assign the column to `name`, `address`, `phone`, `email`, or "ignore"
7. Add "Confirm import" button: POST corrected mapping back to `POST /customers/import-confirm`; backend geocodes each row with a progress counter and returns `{ inserted, skipped_duplicates, unverified }`; show a results summary toast
8. Add animated progress bar during geocoding ("Verifying 3 of 8 addresses…")
9. In the customer list, add an orange "Unverified" chip to any row where `verified === false`; tooltip: "Address could not be confirmed — verify before routing"
10. In the Routing dashboard customer selector (Sub-Task 6), render unverified customers greyed-out and non-selectable

### Relevant Context
- Existing Excel tab UI: [`src/App.jsx`](src/App.jsx) — `mode === "import"` section in `CustomersPage`
- Existing customer row: [`src/App.jsx`](src/App.jsx) — `customer-row` div, `avatar` div pattern
- Nominatim: `https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1` — requires `User-Agent: RouteOne/1.0` header

---

## Sub-Task 4 — AI Data Extraction Agent (IBM Granite via watsonx.ai)

**Status:** [ ] pending

### Intent
Build the AI Sort import path: the user pastes a blob of unstructured text containing customer records. IBM Granite extracts structured records with a confidence score per record. Low-confidence records go into a human review queue. The agent **never** silently fails — if it cannot parse something, it says so explicitly.

### Expected Outcomes
- AI Sort tab has a large textarea for pasting raw text (e.g. a forwarded email, messy spreadsheet paste, notes)
- A call to watsonx.ai (Granite) returns a JSON array of extracted records, each with `confidence` (0–1)
- Records with `confidence >= 0.7` appear in a "Ready to import" list (green border)
- Records with `confidence < 0.7` appear in a "Needs review" list (orange border) with editable inline fields
- Any text the agent could not parse at all appears in an "Unreadable" section with the raw snippet shown
- User confirms or edits each record, then clicks "Commit" to insert (triggering geocoding as in Sub-Task 3)
- The LLM is **never** trusted for address accuracy — geocoding always runs separately

### Todo List
1. Add `POST /agents/extract-customers` FastAPI endpoint: accepts `{ raw_text: str }`, calls watsonx.ai Granite, returns `{ records: ExtractedCustomer[], unreadable_snippets: str[] }`
2. Write the Granite system prompt: output **only** a JSON object `{ "records": [...], "unreadable": [...] }`. Each record: `{ name, address, phone, email, confidence }`. Set `confidence < 0.7` for any uncertain field. List unreadable raw text snippets in `"unreadable"`. No prose, no markdown, JSON only.
3. Wrap the LLM response in `try/except json.loads` + Pydantic schema validation; on failure, return `{ error: "Extraction failed — the model returned an unexpected response. Please try again or paste a smaller block of text." }` — never crash or pass malformed data forward
4. In the frontend AI Sort tab, replace the "Run prototype sort" mock button with:
   - A large textarea ("Paste customer records here — emails, notes, spreadsheet text, anything")
   - An "Extract with AI" button that shows a pulsing AI spinner while waiting
   - A model attribution line: "Powered by IBM Granite on watsonx.ai"
5. Render three sections after extraction: "Ready to import" (confidence ≥ 0.7, green left border), "Needs review" (confidence < 0.7, orange left border, inline editable fields), "Could not read" (raw snippets, grey, user can manually copy)
6. Add "Commit all ready" and "Commit selected" buttons that POST confirmed records to `POST /customers`
7. Add a banner: "AI extraction identifies names and contacts — addresses are separately verified against map data before routing"

### Relevant Context
- Existing AI Sort tab: [`src/App.jsx`](src/App.jsx) — `mode === "ai"` section, `sortCustomers()` function (replace entirely)
- watsonx.ai Python SDK: `from ibm_watsonx_ai import Credentials` + `ModelInference`; use `model.generate_text(prompt)` or `model.chat(messages)`
- IBM Granite model: `ibm/granite-3-8b-instruct` (check watsonx.ai console for latest available)
- Confidence threshold: read from `EXTRACTION_CONFIDENCE_THRESHOLD` env var (default `0.7`)

---

## Sub-Task 5 — Set Routes Dashboard (Persistent)

**Status:** [ ] pending

### Intent
Wire the Set Routes dashboard to the real `set_routes` table so saved routes persist, load back into the Routing dashboard pre-populated, and can be edited and deleted.

### Expected Outcomes
- Routes saved from the Routing dashboard appear in Set Routes after a page refresh
- Each saved route card shows: name, customer count, recurrence days, last constraint summary, active/paused status
- "Load into Routing" pre-populates the Routing dashboard with the route's customers and last constraints (always re-optimizes — never replays a cached result)
- "Delete" removes the route from the database with a confirmation prompt
- Recurrence day toggles are persisted to the database on change

### Todo List
1. Add `GET /set-routes`, `POST /set-routes`, `PUT /set-routes/{id}`, `DELETE /set-routes/{id}` FastAPI endpoints in `routers/set_routes.py`
2. Update `SetRoutesPage` to fetch from `GET /set-routes` on mount; show loading skeleton while fetching
3. Add "Load into Routing" button on each saved route card: navigate to Routing dashboard passing `{ customer_ids, last_constraints }` as initial state (via React state or URL params)
4. Add "Delete" button with an inline confirmation ("Are you sure? This cannot be undone") that calls `DELETE /set-routes/{id}`
5. Persist day-toggle changes immediately: on toggle, call `PUT /set-routes/{id}` with updated `recurrence` field
6. Show a "Last constraints" summary line on each card (e.g. "Priority: C1, C2 · C6 before 15:00") derived from `last_constraints` JSONB
7. Add visual polish: card entrance animation (fade + slide up), active/paused status pill with colour coding matching existing CSS patterns

### Relevant Context
- Existing Set Routes UI: [`src/App.jsx`](src/App.jsx) — `SetRoutesPage`, `toggleDay`, `toggleRoute`, `toggleCustomer`
- Data flows: Phase 3 "Save" → `POST /set-routes` → displayed here on refresh
- Existing status pill CSS: `active-status` class in [`src/styles.css`](src/styles.css)

---

## Sub-Task 6 — Routing Dashboard: Personalization Agent + OR-Tools Solver + Map

**Status:** [ ] pending

### Intent
Build the core product differentiator. The user selects verified customers, optionally pastes a plain-English constraint, and receives an OR-Tools-optimized stop order that the agent has translated into structured parameters. The personalization agent is honest: it explicitly tells the user what it could not do and proposes a workable alternative rather than silently failing or hallucinating.

### Expected Outcomes
- Routing dashboard has a depot address input (driver's starting point), a customer multi-selector (verified only), and a free-text personalization box
- On "Optimize": personalization agent returns a `ConstraintSet` **plus** an `agent_notes` field describing anything it could not resolve and a suggested alternative
- `agent_notes` is displayed prominently before the route is shown (e.g. "I couldn't set a hard deadline for C3 because no time was specified — I've treated it as high priority instead. Let me know if you'd like to set a specific time.")
- OR-Tools solver runs on the `ConstraintSet`; result is an ordered stop list with estimated time and distance
- In-app Google Maps JS route preview renders the optimized polyline on a map
- Stop list is manually drag-reorderable after optimization
- Savings banner shows estimated time saved vs. naive (list) order
- "Save" writes to `set_routes`; "Start Route" generates a Google Maps deep link (≤10 stops) or shows a full-screen ordered stop modal (>10 stops)

### Todo List
1. Add depot address input field to the Routing dashboard UI (geocoded before solving; show a "Locating…" indicator)
2. Add a verified-only customer multi-selector: checkbox list with search/filter input; show a count badge "X stops selected"
3. Add a personalization text box: placeholder "e.g. Get to C1 and C2 first, C6 needs to be there before 3pm"; below it, a subtle label "The AI will do its best and tell you clearly if something isn't possible"
4. Add `POST /agents/personalize-route` FastAPI endpoint in `agents/personalization_agent.py`:
   - Input: `{ customers: [{id, name}], instruction: str }`
   - Pass only `id` and `name` to the LLM — never addresses or coordinates
   - System prompt: output only JSON `{ "priority_stops": [...], "time_windows": [...], "agent_notes": "..." }`. In `agent_notes`: explain what could not be resolved and propose a specific alternative. If all constraints are clear, set `agent_notes` to `null`. Never hallucinate a stop ID — omit any name you cannot confidently match to an ID.
   - Validate all returned IDs server-side against the submitted customer list; strip any IDs not in the list before returning
5. Add `POST /solver/optimize` endpoint in `solver/route_solver.py`:
   - Input: `{ depot_address, customer_ids, constraints: ConstraintSet }`
   - Geocode depot; fetch customer lat/lon from DB
   - Call Google Maps Distance Matrix API; build a time matrix
   - Run OR-Tools `RoutingModel`: hard time windows → `AddDimension` with upper/lower bounds; soft priorities → penalty arcs; objective: minimize total travel time
   - If constraints make the route infeasible, relax soft constraints first; if still infeasible, return `{ error: "Hard time constraints conflict — e.g. C6 before 3pm and C4 before 2pm cannot both be satisfied given drive times. Try relaxing one deadline." }` with specific conflict details
   - Return `{ optimized_order, total_distance_m, total_duration_s, naive_distance_m, naive_duration_s }`
6. Render the optimized stop list as a numbered drag-reorderable list (HTML5 drag-and-drop); each stop shows customer name, address, ETA
7. If `agent_notes` is non-null, show a highlighted agent message card above the route (teal left border, "AI Note" label, agent's message text, a "Got it" dismiss button)
8. Render Google Maps JS API map below the stop list: plot a polyline through the optimized stops in order; add numbered markers matching the stop list; use the existing dark teal colour palette
9. Show savings banner: "This route saves ~X min and Y km vs. the original order" (computed from naive vs. optimized values)
10. "Save" button: POST to `POST /set-routes` with `name`, `customer_ids` (optimized order), `last_constraints`
11. "Start Route" button: ≤10 stops → open Google Maps deep link in new tab; >10 stops → open a full-screen modal with the ordered stop list, each stop numbered with a "Copy address" button

### Relevant Context
- Existing Plan Routes UI: [`src/App.jsx`](src/App.jsx) — `PlanRoutesPage` (substantially extend this component)
- OR-Tools: `from ortools.constraint_solver import routing_enums_pb2, pywrapcp`; use `RoutingIndexManager` + `RoutingModel`
- Google Maps JS API: load via `<script>` tag with key from env; use `google.maps.DirectionsRenderer` or `Polyline` + `Marker`
- Google Maps Distance Matrix: `https://maps.googleapis.com/maps/api/distancematrix/json?origins=...&destinations=...&mode=driving&key=...`
- Google Maps deep link format: `https://www.google.com/maps/dir/?api=1&origin={lat,lng}&destination={lat,lng}&waypoints={lat,lng}|{lat,lng}&travelmode=driving`
- Agent honesty rule: `agent_notes` must either be `null` (everything resolved) or contain both (a) what could not be done and (b) a specific proposed alternative — never vague acknowledgment

---

## Sub-Task 7 — Polish, Demo Data & Submission Readiness

**Status:** [ ] pending

### Intent
Make the project demo-ready for judges: realistic seed data, a before/after savings comparison, UI visual polish pass, and a complete README with the IBM technology section explicitly documented.

### Expected Outcomes
- A seed script populates the database with a realistic 12–15 stop scenario with mixed priorities and one time-window constraint
- The savings banner appears on every completed route optimization
- README has an explicit IBM Technology section naming Granite model ID, watsonx.ai endpoint, and what each agent does
- `.env.example` files exist for both frontend and backend
- The project runs end-to-end on free tiers only

### Todo List
1. Write `backend/seed.py`: inserts a demo user + 12–15 customers with real addresses (e.g. Montreal delivery scenario), a saved set route, and a realistic instruction string to demo the personalization agent
2. Final visual polish pass:
   - Add micro-animations to the three dashboard cards on hover (lift + glow)
   - Add a route progress stepper in the Routing dashboard (Step 1: Select stops → Step 2: Add constraints → Step 3: Optimize → Step 4: Start)
   - Add confetti or a subtle "Route ready!" animation when optimization completes
   - Ensure the app is fully responsive on a 768px tablet viewport (judges may demo on a laptop)
3. Write `README.md` with sections: Overview, Problem, Architecture (ASCII diagram), IBM Technology Usage (explicit: Granite model ID, watsonx.ai endpoint, what each agent does, why the two agents are separate), Setup (step-by-step), Demo Script
4. Add `docs/architecture.md` with the full system diagram from the spec
5. Add `docs/demo-script.md`: exact click-through a judge follows to see the AI agents and solver live
6. Add `docs/bob-usage.md`: document where Bob was used in the build (planning, code generation, review) — required for IBM submission
7. Create `/frontend/.env.example` and `/backend/.env.example` with all keys listed as `YOUR_KEY_HERE`
8. Final audit: no hardcoded credentials, all API keys from env, solver cap at 25 stops enforced, Nominatim 1s delay enforced

### Relevant Context
- IBM submission requirement: explicit IBM tech usage section + Bob usage documentation
- IBM Granite touchpoints: extraction agent (Sub-Task 4) + personalization agent (Sub-Task 6) — both named by model ID in README
- Savings banner pattern already exists in prototype: `bottom-action-card` CSS class in [`src/styles.css`](src/styles.css)

---

## Loopholes & Risks

| Risk | Mitigation |
|---|---|
| Nominatim rate limit (1 req/s) | Geocode at import time only; `asyncio.sleep(1)` between calls; show animated progress bar in UI |
| Google Maps Distance Matrix free tier | 25-stop cap = up to 625 elements / 7 requests; cache the matrix per unique customer set in the session |
| OR-Tools time window infeasibility | Relax soft constraints first; if still infeasible, return a detailed conflict message naming the conflicting stops — never silently return a wrong route |
| Granite JSON hallucination | Always `json.loads` + Pydantic validate; on failure return a structured error message to the frontend — never crash |
| Google Maps deep link >10 waypoints | Documented above — ordered list is the primary output; deep link is a convenience for small routes |
| watsonx.ai latency | Show a pulsing spinner on both agent calls; personalization agent call is async — UI remains responsive |
| Supabase free tier connection limits | Single Supabase client instance per backend process; never open a new connection per request |
| Agent hallucinating a stop that doesn't exist | Server-side ID validation after every agent call — strip any ID not in the submitted customer list before passing to solver |
| User frustration when agent can't satisfy a request | `agent_notes` is required to propose a specific actionable alternative — e.g. "I can't set C3 before 10am given drive times from the depot. Would you like to set C3 as high priority instead, or adjust the depot start time?" |

---

## Suggested Repo Structure

```
/frontend
  /src
    App.jsx           (extended from prototype)
    supabase.js       (Supabase client singleton)
    api.js            (fetch wrappers for backend endpoints)
    components/       (MapView, StopList, AgentNoteCard, ToastNotification, etc.)
    styles.css        (extended from prototype)
  .env
  .env.example

/backend
  main.py             (FastAPI app, router registration)
  auth.py             (JWT verification dependency)
  database.py         (Supabase client singleton)
  requirements.txt
  seed.py
  /routers
    customers.py
    set_routes.py
    route_runs.py
  /agents
    extraction_agent.py     (IBM Granite via watsonx.ai)
    personalization_agent.py (IBM Granite via watsonx.ai)
  /solver
    route_solver.py         (OR-Tools TSP/VRP)
    distance_matrix.py      (Google Maps Distance Matrix)
  .env
  .env.example

/docs
  architecture.md
  demo-script.md
  bob-usage.md

README.md
```
