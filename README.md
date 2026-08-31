# RANRoute Everywhere

> AI-powered delivery route optimization for solo and small-fleet businesses — IBM AI Builders Challenge submission

---

## What it does

RANRoute Everywhere lets a dispatcher build an optimized daily delivery route by typing plain-English instructions. No GPS fleet required. No ops team. Just type, optimize, and go.

- **Paste messy text** → IBM Granite extracts structured customer records with confidence scores
- **Type a preference** → *"Get to the bakery first, pharmacy before 3pm"* → AI translates it into solver constraints
- **OR-Tools optimizes** the stop order across up to 25 stops using a real combinatorial solver
- **Google Maps preview** renders the route with a numbered polyline
- **Savings banner** shows time and distance saved vs. naive order — tracked cumulatively on the dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Python 3.11 + FastAPI |
| Database / Auth | Supabase (Postgres + RLS + Auth) |
| AI Agents | IBM Granite `ibm/granite-3-8b-instruct` via watsonx.ai |
| Route Solver | Google OR-Tools |
| Maps | Google Maps JS API + Distance Matrix API |
| Geocoding | Nominatim (OpenStreetMap) |

**Technologies:** React • Vite • Python • FastAPI • Supabase • PostgreSQL • IBM Granite • watsonx.ai • OR-Tools • Google Maps API • Nominatim • OpenStreetMap

---

## IBM AI Touchpoints

Three IBM Granite agents power the core intelligence:

| Agent | What it does |
|---|---|
| **Extraction Agent** | Parses unstructured text (emails, notes, spreadsheet pastes) into structured customer records. Returns a confidence score per record — uncertain records go to a human review queue. |
| **Address Normalizer** | Second pass after extraction — uses geographic context from the original text to clean and complete partial addresses before geocoding. |
| **Personalization Agent** | Translates plain-English routing preferences into a structured constraint set (priority stops + time windows) for OR-Tools. Explicitly reports anything it cannot satisfy with a specific alternative — never silently fails. |

All agents run backend-only. The LLM never sees addresses or coordinates — only `{id, name}` pairs. All returned IDs are validated server-side before reaching the solver.

---

## Features

- **3-path customer import** — manual entry, Excel/CSV drag-drop with column mapping, AI text extraction
- **Background geocoding** — Nominatim verifies addresses after import; unverified rows show an editable inline editor
- **Route stepper** — 3-step flow: select stops → add AI preferences → view optimized result
- **Agent reasoning panel** — shows exactly what IBM Granite parsed from your instruction
- **Agent notes card** — honestly explains what the AI couldn't do and proposes a specific alternative
- **Savings dashboard** — cumulative time and distance saved across all route runs
- **Set Routes** — save, reuse, and schedule recurring routes with day toggles
- **Start Route** — Google Maps deep link for ≤10 stops; full-screen stop modal for larger routes

---

## Setup

### Prerequisites
- Node 18+, Python 3.11+
- Supabase project (free tier)
- IBM Cloud account with watsonx.ai + Watson Machine Learning instance
- Google Cloud project with Maps JS, Distance Matrix, and Geocoding APIs enabled

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # fill in Supabase + Google Maps keys
npm run dev            # http://localhost:5173
```

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env        # fill in all keys
uvicorn main:app --reload   # http://localhost:8000
```

### Database
Run `backend/sql/schema.sql` once in the Supabase SQL Editor.

### Seed data (optional)
```bash
# Set SEED_USER_ID in backend/.env to your Supabase auth user UUID
python seed.py
```

---

## Project Structure

```
frontend/src/
  App.jsx          — full UI (Login, Customers, Plan Routes, Set Routes)
  api.js           — all backend calls with JWT injection
  styles.css       — dark theme

backend/
  main.py          — FastAPI app
  auth.py          — JWT verification
  routers/         — customers, agents, set_routes, solver, route_runs
  agents/          — extraction, address_normalizer, personalization (IBM Granite)
  solver/          — OR-Tools TSP + Google Maps Distance Matrix
  utils/           — Nominatim geocoder
  sql/             — Supabase schema

docs/
  architecture.md  — system diagram + request flows
  demo-script.md   — judge walkthrough
  bob-usage.md     — IBM Bob usage documentation

test-data/
  TEST_CASES.md         — full demo walkthrough
  customers_clean.csv   — clean import test
  customers_bad_addresses.csv — bad address test (AI normalizer demo)
```

---

## Docs

- [Architecture](docs/architecture.md)
- [Demo Script](docs/demo-script.md)
- [IBM Bob Usage](docs/bob-usage.md)
- [Build Plan](PLAN.md)
