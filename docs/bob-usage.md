# RouteOne — Bob Usage Documentation

**Required for IBM AI Builders Challenge submission.**

This document records how IBM Bob (AI-assisted development via IBM's coding assistant) was used throughout the RouteOne build.

---

## Overview

Bob was used as the primary development agent for this project — not just for code suggestions, but for architecture planning, full feature implementation, debugging, and documentation generation.

---

## Phase 1 — Project Specification & Architecture

**What Bob did:**
- Reviewed the initial product concept and produced a full `routeone-plan.md` specification covering all 7 sub-tasks, data models, architecture decisions, risk mitigations, and API contracts
- Recommended against using LangChain/LangFlow in favour of direct `ibm_watsonx_ai` SDK calls — rationale: agents are simple single-turn JSON-extraction tasks, no orchestration framework needed
- Locked architecture decisions: Supabase for auth + DB, Nominatim for geocoding, OR-Tools for solver, two separate Granite agents

---

## Phase 2 — Scaffold & Auth (Sub-Task 1)

**What Bob built:**
- Full monorepo structure: `/frontend` (React + Vite) and `/backend` (FastAPI)
- Replaced hardcoded login credentials with real Supabase Auth (`signUp`, `signInWithPassword`, `resetPasswordForEmail`, `signOut`)
- JWT verification FastAPI dependency (`auth.py`) using `supabase.auth.get_user(token)`
- Singleton DB client pattern (`database.py`) to avoid per-request connections
- Login screen with animated gradient hero, loading spinners, sign-up/forgot-password toggle
- Profile setup modal (first-login flow, stored in `localStorage`)
- Both `.env.example` files

---

## Phase 3 — Database Schema & Customer API (Sub-Task 2)

**What Bob built:**
- Complete Postgres schema (`sql/schema.sql`) for `customers`, `set_routes`, `route_runs` with RLS policies
- Full CRUD API (`routers/customers.py`) with ownership-scoped queries
- Server-side duplicate detection on phone, email, and address (HTTP 409 with field list)
- Pydantic models (`models/customer.py`)
- Frontend `CustomersPage` wired to real API with loading skeletons and toast notifications

---

## Phase 4 — Excel Import & Geocoding (Sub-Task 3)

**What Bob built:**
- `POST /customers/import-preview` — pandas/openpyxl file parsing, auto column detection
- `POST /customers/import-confirm` — row-by-row duplicate check, immediate insert, background geocoding
- Nominatim geocoder (`utils/geocoding.py`) with address variant fallbacks (apostrophe fixes, province abbreviation expansion, unit stripping, Canada suffix)
- 3-step drag-drop import UI in React (drop zone → column mapping table → result summary)
- Orange "Unverified" chip on customers with unresolved addresses

---

## Phase 5 — AI Extraction Agent (Sub-Task 4)

**What Bob built:**
- `GraniteAgent` base class (`agents/base.py`) wrapping `ibm_watsonx_ai.foundation_models.ModelInference`
  - Retry logic (3× on JSON parse failure)
  - Markdown code fence stripping
  - Typed exception hierarchy (EnvironmentError / RuntimeError / ValueError)
- Extraction agent system prompt (instructs Granite to output only JSON with confidence scores)
- `extract_customers()` function with shape validation and confidence clamping
- `POST /agents/extract-customers` endpoint with input length guard
- `AISort` React component with three result buckets (Ready / Needs Review / Could not read), inline editing, commit flow

---

## Phase 6 — Set Routes Persistence (Sub-Task 5)

**What Bob built:**
- `routers/set_routes.py` — full CRUD for saved route templates
- `SetRoutesPage` rewritten from in-memory state to real DB-backed component
  - Fetch on mount with loading skeletons
  - Day toggle persists to DB immediately
  - Active/Pause toggle via PUT
  - Delete with inline confirmation
  - "Load into routing" button that pre-populates PlanRoutesPage

---

## Phase 7 — Personalization Agent + Solver (Sub-Task 6)

**What Bob built:**
- `agents/personalization_agent.py` — second Granite agent with routing-specific system prompt
  - ID-only customer list passed to LLM (addresses never exposed)
  - Server-side ID validation strips hallucinated IDs
  - `agent_notes` required to be either null or (what failed + specific alternative)
- `solver/distance_matrix.py` — Google Maps Distance Matrix API wrapper
- `solver/route_solver.py` — OR-Tools TSP solver
  - Time window dimensions (hard constraints)
  - Priority stop disjunctions (soft constraints)
  - Infeasibility handling with constraint relaxation and descriptive error messages
  - Naive-order metric computation for savings banner
- `routers/solver.py` — POST /solver/optimize endpoint with 25-stop cap
- `PlanRoutesPage` fully rebuilt:
  - 3-step stepper UI
  - Depot address input
  - Verified-only customer selector with search
  - AI personalization textarea
  - Agent notes card (teal border, "Got it" dismiss)
  - Savings banner
  - Google Maps JS polyline preview
  - Start Route deep link (≤10 stops) / modal (>10 stops)

---

## Phase 8 — Polish & Docs (Sub-Task 7)

**What Bob built:**
- `backend/seed.py` — 14 Toronto-area demo customers + 1 saved route
- `docs/architecture.md` — full system diagram
- `docs/demo-script.md` — judge walkthrough with IBM touchpoint call-outs
- `docs/bob-usage.md` — this file
- `HANDOFF.md` — complete project handoff for agent continuity between sessions
- CSS additions: AI Sort styles, route stepper, agent note card, savings banner, optimized stop list

---

## IBM Technology Summary

| Technology | Where used |
|---|---|
| IBM Bob (this tool) | Entire build — architecture, all backend files, all frontend components, all docs |
| IBM Granite (`ibm/granite-3-8b-instruct`) | Extraction Agent + Personalization Agent |
| watsonx.ai | Model inference endpoint for both agents |
