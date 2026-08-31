# RouteOne — Demo Script

This script walks a judge through the full product in under 10 minutes, hitting every IBM technology touchpoint.

---

## Setup (before the demo)

1. Backend running: `uvicorn main:app --reload` from `/backend`
2. Frontend running: `npm run dev` from `/frontend`
3. Seed data loaded: `python seed.py` from `/backend` (run once)
4. Sign in with your demo account at `http://localhost:5173`

---

## Step 1 — Home Dashboard (30 seconds)

- Point out the three-card layout: **Customers → Plan Routes → Set Routes**
- Show the customer count pill in the top-right of the welcome banner
- Mention: "No GPS fleet required. Everything starts with your customer list."

---

## Step 2 — AI Sort: IBM Granite Extraction Agent (2 minutes)

1. Click **Manage customers → AI Sort tab**
2. Paste the following messy text into the textarea:

```
Hey, here are the stops for Tuesday:

Baker's Best Bread, they're at 450 Front St W Toronto, call Mark on 416-222-3344.
Then swing by Riverside Kitchen (1015 Queen St E) — ask for Fiona, email is riverside@kitchen.ca
Also add: Ossington Photo Studio 69 Ossington Ave Toronto ON, contact Jake Moore
One more — beaches surf & board 2153 queen east toronto, Ryan James, 416-555-0114

Not sure about this one: "the new place near the park, you know the one" — couldn't get an address.
```

3. Click **Extract with AI →** and watch the spinner
4. When results appear, point out:
   - **Ready to import** section (green border) — 4 high-confidence records
   - **Needs review** section (orange border) — any uncertain ones
   - **Could not read** section — the vague "new place near the park" snippet
5. Click **Commit all** → customers appear in the list instantly
6. Point out the **orange "Unverified" badge** — address geocoding runs in background

> **IBM touchpoint:** "This is IBM Granite (`ibm/granite-3-8b-instruct`) on watsonx.ai. The confidence score per record is returned by the model — we split at 0.7 so humans review anything uncertain."

---

## Step 3 — Plan Routes: Personalization Agent + OR-Tools (4 minutes)

1. Click **Plan a route** from home
2. **Step 1 — Select stops:**
   - Enter depot: `460 King St W, Toronto, ON M5V 1L7`
   - Name the route: `Tuesday West Side Run`
   - Select 6–8 verified customers (or click "All")
   - Click **Next: Add preferences →**

3. **Step 2 — Add preferences:**
   - Paste this instruction:
   ```
   Get to Kensington Market Deli and Bloor Street Bakery first — they open at 8am.
   High Park Organic needs to be before 11am.
   ```
   - Click **Optimize route →**
   - While spinning: "The AI is interpreting this in plain English, then OR-Tools is running the combinatorial optimization."

4. **Step 3 — Results:**
   - Point out the **AI Note card** (teal border) if Granite couldn't satisfy something — it explains what and proposes an alternative
   - Point out the **savings banner** — "~X min and Y km saved vs. original order"
   - Show the **numbered stop list**
   - If Google Maps key is set, show the **map preview** with green polyline
   - Click **Save route** → confirmation toast → goes to Set Routes

> **IBM touchpoint:** "Two separate agents: the extraction agent earlier parsed customer data. This personalization agent translates English into a structured constraint set — priority stops and time windows — which OR-Tools then solves mathematically."

---

## Step 4 — Set Routes: Persistence + Load (1 minute)

1. Show the saved route card with stop count and last-constraint summary
2. Toggle a day (Mon/Wed/Fri) — updates live to DB
3. Click **Load into routing** — returns to Plan Routes pre-populated with those stops
4. Point out: "This is the repeat-route workflow — save once, reuse every week, always re-optimizes fresh."

---

## Step 5 — Start Route (30 seconds)

1. From the optimized result, click **Start route →**
2. For ≤10 stops: Google Maps deep link opens with the route pre-loaded
3. For >10 stops: Show the modal with numbered stops and "Copy address" buttons

---

## Key Talking Points for Q&A

| Question | Answer |
|---|---|
| Why two separate AI agents? | Different domains: one parses unstructured data into records (extraction), one interprets intent into constraints (personalization). Mixing them would make each worse at its job. |
| What if the AI gives a wrong address? | It can't. The LLM never sees addresses — only `{id, name}` pairs. Geocoding runs separately via Nominatim, completely independent of the LLM. |
| What if the AI hallucinates a customer? | Server-side ID validation strips any ID not in the submitted list before it reaches the solver. |
| What if constraints are impossible? | OR-Tools detects infeasibility, relaxes soft constraints first, and returns a specific error message naming the conflicting stops. The agent also proactively warns via `agent_notes`. |
| Is this free to run? | Supabase free tier, Nominatim (free), OR-Tools (open-source). Only Google Maps and watsonx.ai have usage costs — both have free tiers that cover a demo. |
