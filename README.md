# RANRoute

AI-powered route planning for solo and small-fleet delivery businesses. — IBM AI Builders Challenge submission

---

## Problem Statement

Small businesses running delivery or service routes — couriers, home-service technicians, local delivery drivers — either plan routes manually (slow, error-prone) or are priced out of enterprise routing systems built for fleets with historical data. There is no accessible tool that lets a single dispatcher build an optimized daily route on day one, without a learning period, a fleet-scale data contract, or a technical operations team.

---



## Solution

RanRoute lets dispatchers build optimized daily routes through plain-language instructions — no GPS fleet or historical data required. A dispatcher types what they need ("get to Customer 1 first, Customer 6 before 3 pm") and the system translates that into a concrete, executable plan backed by real map data and a proven optimization engine.

Three customer import paths — manual entry, Excel/CSV upload, and AI-assisted text extraction — all converge on the same verified customer list. Every address is geocoded independently of the AI, ensuring the AI's confidence in parsing text never gets confused with confidence in address accuracy.

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
## AI Approach & Architecture

RANRoute uses **two purpose-scoped AI agents**, both powered by IBM Granite on watsonx.ai, plus a deterministic route solver:

### Agent 1 — Data Extraction Agent
Converts unstructured text (emails, notes, messy spreadsheet pastes) into structured customer records. Returns a JSON object `{ records, unreadable }` with a `confidence` score per record. Records below the 0.7 threshold are flagged for human review rather than auto-imported.

### Agent 2 — Route Personalization Agent *(in progress)*
Converts plain-English routing instructions into a structured `ConstraintSet` (priority stops + time windows). The agent only references customer IDs from the submitted list — it never invents a stop. It must explicitly report anything it cannot satisfy and propose a specific alternative.

### Route Solver — OR-Tools
The `ConstraintSet` from the Personalization Agent is fed into an OR-Tools VRP/TSP solver:
- **Hard time windows** → upper/lower bounds on a node's time dimension
- **Soft priority stops** → penalty-weighted arcs so the solver trades off urgency against total drive time
- **Objective** → minimize total travel time

This separation (LLM for language understanding, deterministic optimizer for combinatorial math) avoids the common failure mode of asking a language model to do arithmetic it is not reliable at.

```
Browser (React + Vite)
    │  JWT in Authorization header
    ▼
FastAPI (Python)
    ├── /customers  — CRUD, Excel/CSV import, background geocoding (Nominatim)
    ├── /agents
    │     ├── POST /extract-customers    — Granite Extraction Agent
    │     └── POST /personalize-route   — Granite Personalization Agent
    └── /solver
          └── POST /optimize            — OR-Tools + Google Maps Distance Matrix

Supabase (Postgres + Auth)
    ├── public.customers   (RLS: user_id = auth.uid())
    ├── public.set_routes  (RLS: user_id = auth.uid())
    └── public.route_runs  (RLS: user_id = auth.uid())

watsonx.ai (IBM Cloud)
    └── ibm/granite-3-8b-instruct
          ├── Extraction Agent
          └── Personalization Agent
```

---

## Selected Challenge Theme

**IBM AI Builders Challenge — Wildcard Track: "Build Intelligent Systems for the Future of Work"**

RANRoute's core interaction is an AI agent acting as a **collaborator**, not just an automation script. The user describes intent and the system translates that into a concrete, executable plan — decision support and intelligent automation applied to a real operational workflow, directly aligned with the Wildcard theme.


## IBM AI Touchpoints

Three IBM Granite agents power the core intelligence:

| Agent | What it does |
|---|---|
| **Extraction Agent** | Parses unstructured text (emails, notes, spreadsheet pastes) into structured customer records. Returns a confidence score per record — uncertain records go to a human review queue. |
| **Address Normalizer** | Second pass after extraction — uses geographic context from the original text to clean and complete partial addresses before geocoding. |
| **Personalization Agent** | Translates plain-English routing preferences into a structured constraint set (priority stops + time windows) for OR-Tools. Explicitly reports anything it cannot satisfy with a specific alternative — never silently fails. |

All agents run backend-only. The LLM never sees addresses or coordinates — only `{id, name}` pairs. All returned IDs are validated server-side before reaching the solver.

## How IBM Bob Was Used

IBM Bob — IBM's AI coding assistant — was used as the primary development partner throughout the entire build. Bob authored the project specification and architecture, scaffolded the full monorepo, implemented auth, database schema, customer CRUD, Excel import, background geocoding, and the Granite extraction agent. Bob also produced all project documentation including this README. Rather than using Bob for occasional snippets, the entire codebase was built through an ongoing Bob conversation — planning each sub-task, generating the implementation, and iterating on bugs and edge cases in the same context. See **[docs/ibmbobusage.md](docs/ibmbobusage.md)** for a full breakdown by build area.

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
- [IBM Bob Usage](docs/bob-usage.md)
- [Build Plan](PLAN.md)
