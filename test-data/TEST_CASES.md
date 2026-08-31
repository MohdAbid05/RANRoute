# RouteOne — Demo Test Data

All test cases for the competition demo. Run through these in order.

---

## TEST 1 — Manual Entry (5 customers)

Enter these one by one in **Customers → Manual entry tab**.
All have clean Toronto addresses that Nominatim will verify.

| # | Name | Contact | Phone | Address |
|---|---|---|---|---|
| 1 | Kensington Market Deli | Rosa Chen | 416-555-0201 | 191 Baldwin St, Toronto, ON M5T 1L4 |
| 2 | Bloor Street Bakery | Ahmed Faruk | 416-555-0202 | 641 Bloor St W, Toronto, ON M6G 1L1 |
| 3 | Little Italy Imports | Maria Rossi | 416-555-0203 | 534 College St, Toronto, ON M6G 1A9 |
| 4 | Trinity Bellwoods Cafe | Priya Sharma | 416-555-0204 | 900 Dundas St W, Toronto, ON M6J 1W2 |
| 5 | Ossington Photo Studio | Jake Moore | 416-555-0205 | 69 Ossington Ave, Toronto, ON M6J 2Y9 |

**Expected result:** All 5 added, background geocoding runs, "Unverified" badges disappear within ~30 seconds as Nominatim resolves each address.

---

## TEST 2 — Excel Import (5 clean customers)

Use the file: `test-data/customers_clean.csv`

Upload in **Customers → Excel / CSV tab**.
Column mapping will be auto-detected.

**Expected result:** Preview shows 5 rows, detected mapping finds Name/Address/Phone/Email/Contact. Import inserts all 5, background geocoding runs.

---

## TEST 3 — Excel Import (5 badly-formatted addresses)

Use the file: `test-data/customers_bad_addresses.csv`

Upload in **Customers → Excel / CSV tab**.

**What "badly formatted" means here:**
- Missing city name
- Province abbreviation only (no city)  
- Unit number before street number
- Casual/shortened street names
- Missing street type (no "St" or "Ave")

**Expected result:**
- All 5 import immediately as `verified: false` (orange Unverified badge)
- Background geocoding attempts but mostly fails on the raw addresses
- Click the **"Unverified — edit"** chip on any row to open the inline editor
- The AI Sort normalization agent will also suggest improved versions if these are pasted into AI Sort

---

## TEST 4 — AI Sort (email paste with mixed-quality records)

Go to **Customers → AI Sort tab** and paste this entire block:

```
Hi team — here are the Tuesday stops, pulled from my notes app:

1) Parkdale Print Shop - 1313 Queen West Toronto, Lena's the contact, her cell is 416-555-0307

2) Junction Arts Supply
   2888 dundas st w, toronto on
   Tom Ellis, tom@junctionarts.ca

3) High Park Organic Co.
   1873 bloor st west, toronto
   Sarah Wu - 416-555-0305

4) riverside kitchen - 1015 queen east, contact Fiona Bell, riverside@kitchen.ca, 416-555-0313

5) dufferin grove pottery, 55 dufferin st toronto on m6k 2x8, omar@dufferin.ca, Omar Bah 416-555-0308

6) That new coffee place near the park on roncy - no address yet, will update

7) beaches - ryan james, 2153 queen st east toronto, 416-555-0114

Note: please double-check the Bloor St bakery address before adding
```

**What the agents do:**
- **Extraction agent:** Finds 6 real records (1–5 + 7), flags #6 as unreadable
- **Address normalizer:** Improves lowercase/abbreviated addresses using "toronto" as context — e.g. "1313 Queen West Toronto" → "1313 Queen St W, Toronto, ON"
- #6 appears in "Could not read" section with the raw snippet

**Expected result:**
- Ready to import: 5–6 records with green border and confidence ≥ 0.7
- Needs review: 0–1 records (possibly the "riverside kitchen" informal name)
- Could not read: 1 record — the coffee place with no address
- Several records show the purple **"AI improved"** badge with toggle to see original vs. normalized

---

## TEST 5 — Plan Route (5 stops with AI constraint)

**Setup:**
- Use the 5 customers from Test 1 (they should now be verified)
- Or load the "West Side Morning Run" from Set Routes if you ran seed.py

**Step 1 — Select stops:**
- Depot: `460 King St W, Toronto, ON M5V 1L7`
- Route name: `Tuesday Demo Run`
- Select all 5 Test 1 customers

**Step 2 — Add this constraint (copy-paste exactly):**

```
Get to Kensington Market Deli first — they need delivery before 9am.
Ossington Photo Studio should be last.
```

**Why this constraint works reliably:**
- "First" maps cleanly to `priority_stops`
- "Before 9am" maps cleanly to `time_windows: [{ before: "09:00" }]`
- "Last" — the agent will note it can suggest making Ossington lowest priority (it cannot enforce "last" as a hard constraint, so `agent_notes` will say: *"I can't guarantee Ossington is the final stop, but I've deprioritized it so OR-Tools will tend to schedule it late. If you need it last, reduce the stop count to make the route linear."*)

**Expected result:**
- Agent reasoning panel shows: `Priority stops identified: Kensington Market Deli` + `Kensington Market Deli: before 09:00`
- Agent notes card (teal border) explains the "last" limitation with a specific alternative
- Savings banner shows time/distance saved vs. naive order
- Numbered stop list with Kensington at #1
- Google Maps polyline preview (if Maps key set)

**Save the route** → goes to Set Routes with the saved card.
**Click "Start route"** → Google Maps deep link opens with ≤5 stops pre-loaded.

---

## Constraint cheat sheet — things the personalization agent handles reliably

| Instruction phrasing | What the agent returns |
|---|---|
| `"Get to X first"` | `priority_stops: [X_id]` |
| `"X before 3pm"` / `"X needs to be before 15:00"` | `time_windows: [{customer_id: X, before: "15:00"}]` |
| `"X after 9am"` | `time_windows: [{customer_id: X, after: "09:00"}]` |
| `"X and Y first, both open at 8"` | `priority_stops: [X_id, Y_id]`, no time window (opening time ≠ delivery deadline) |
| `"X between 10am and 12pm"` | `time_windows: [{after: "10:00", before: "12:00"}]` |
| `"Get to X early, Z last"` | `priority_stops: [X_id]` + `agent_notes` explaining "last" can't be hard-enforced |

**Constraint to avoid for the demo** (may confuse the agent):
- Very long compound instructions with 4+ customers each with different windows
- Referring to customers by nickname ("the bakery", "the photo guy") — use exact names from your list
