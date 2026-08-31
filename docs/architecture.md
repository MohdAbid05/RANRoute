# RouteOne — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React + Vite)                   │
│                                                                 │
│  LoginScreen → App → HomePage                                   │
│                    → CustomersPage (Manual / Excel / AI Sort)   │
│                    → PlanRoutesPage (Depot → Select → Optimize) │
│                    → SetRoutesPage  (Saved routes DB-backed)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP + Bearer JWT
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI  (localhost:8000)                   │
│                                                                 │
│  auth.py          ── verifies JWT via supabase.auth.get_user()  │
│                                                                 │
│  /customers       ── CRUD + import-preview + import-confirm     │
│  /agents                                                        │
│    POST /extract-customers  ── GraniteAgent (extraction)        │
│    POST /personalize-route  ── GraniteAgent (personalization)   │
│  /set-routes      ── CRUD for saved route templates             │
│  /solver                                                        │
│    POST /optimize ── OR-Tools TSP + Google Maps Distance Matrix │
└──────┬──────────────┬──────────────┬───────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────┐  ┌─────────────┐  ┌──────────────────────────────┐
│ Supabase │  │ watsonx.ai  │  │  External APIs               │
│ Postgres │  │ (IBM Cloud) │  │                              │
│          │  │             │  │  Nominatim (geocoding)       │
│customers │  │ granite-3-  │  │  Google Maps Distance Matrix │
│set_routes│  │ 8b-instruct │  │  Google Maps JS (frontend)   │
│route_runs│  │             │  │  Google Maps Geocoding API   │
└──────────┘  └─────────────┘  └──────────────────────────────┘
```

## Request Flow — Route Optimization

```
User clicks "Optimize route"
    │
    ├─► POST /agents/personalize-route
    │     Input: [{id, name}] + instruction (NO addresses sent to LLM)
    │     GraniteAgent → { priority_stops, time_windows, agent_notes }
    │     Server-side: strip any IDs not in submitted list
    │     ↓
    ├─► POST /solver/optimize
    │     1. Geocode depot (Google Maps → Nominatim fallback)
    │     2. Fetch customer lat/lon from Supabase
    │     3. Google Maps Distance Matrix → NxN duration matrix
    │     4. OR-Tools RoutingModel
    │          Hard: time window dimensions (AddDimension)
    │          Soft: priority stops (disjunction penalties)
    │          Objective: minimize total travel time
    │          Time limit: 10s
    │     5. Compute naive (original order) metrics for savings banner
    │     6. Return optimized_order + distances + durations
    │     ↓
    └─► Frontend renders:
          Agent notes card (if agent_notes ≠ null)
          Savings banner (naive − optimized)
          Numbered stop list
          Google Maps JS polyline preview
          Save / Start Route buttons
```

## Data Model

```
customers
  id uuid PK | user_id FK | name | address | phone | email | contact
  lat | lon | verified bool | source (manual/excel/ai) | created_at

set_routes
  id uuid PK | user_id FK | name | customer_ids uuid[]
  last_constraints jsonb | recurrence text | active bool | created_at

route_runs
  id uuid PK | user_id FK | depot_address | customer_ids uuid[]
  optimized_order uuid[] | constraints jsonb
  total_distance_m | total_duration_s | naive_distance_m | naive_duration_s
  status (draft/saved/started/completed) | created_at
```

## Security Model

- All tables have Row Level Security: `auth.uid() = user_id`
- Supabase anon key in frontend (safe — RLS enforces ownership)
- Supabase service key backend-only (bypasses RLS for trusted server queries)
- JWT verified on every FastAPI request via `get_current_user` dependency
- LLM never receives addresses or coordinates — only `{id, name}` pairs
- All LLM-returned customer IDs validated server-side before use
