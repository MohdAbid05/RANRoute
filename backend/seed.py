"""
backend/seed.py — Populate Supabase with a realistic demo dataset.

Usage (from /backend with .venv active):
    python seed.py

What it creates:
  - 14 customers in the Greater Toronto Area with real addresses
  - 1 saved set route using the first 8 customers
  - Prints the demo instruction string to use in the Personalization Agent demo

Requires SUPABASE_URL, SUPABASE_SERVICE_KEY, and a valid user UUID in SEED_USER_ID.
Set SEED_USER_ID to your own Supabase auth user UUID before running.
"""
import os, sys, time
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
USER_ID      = os.environ.get("SEED_USER_ID", "")

if not USER_ID:
    print("ERROR: Set SEED_USER_ID in your .env to your Supabase auth user UUID.")
    sys.exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 14 Toronto-area customers ─────────────────────────────────────────────────
CUSTOMERS = [
    {"name": "Kensington Market Deli",    "address": "191 Baldwin St, Toronto, ON M5T 1L4",       "phone": "416-555-0101", "email": "kensington@deli.ca",  "contact": "Rosa Chen"},
    {"name": "Bloor Street Bakery",        "address": "641 Bloor St W, Toronto, ON M6G 1L1",       "phone": "416-555-0102", "email": "bloor@bakery.ca",      "contact": "Ahmed Faruk"},
    {"name": "Little Italy Imports",       "address": "534 College St, Toronto, ON M6G 1A9",       "phone": "416-555-0103", "email": "littleitaly@imports.ca","contact": "Maria Rossi"},
    {"name": "Roncesvalles Flowers",       "address": "263 Roncesvalles Ave, Toronto, ON M6R 2M6", "phone": "416-555-0104", "email": "roncy@flowers.ca",     "contact": "Jan Kovac"},
    {"name": "High Park Organic Co.",      "address": "1873 Bloor St W, Toronto, ON M6R 2P1",      "phone": "416-555-0105", "email": "highpark@organic.ca",  "contact": "Sarah Wu"},
    {"name": "Junction Arts Supply",       "address": "2888 Dundas St W, Toronto, ON M6P 1Y8",     "phone": "416-555-0106", "email": "junction@arts.ca",     "contact": "Tom Ellis"},
    {"name": "Parkdale Print Shop",        "address": "1313 Queen St W, Toronto, ON M6K 1L8",      "phone": "416-555-0107", "email": "parkdale@print.ca",    "contact": "Lena Park"},
    {"name": "Dufferin Grove Pottery",     "address": "55 Dufferin St, Toronto, ON M6K 2X8",       "phone": "416-555-0108", "email": "dufferin@pottery.ca",  "contact": "Omar Bah"},
    {"name": "Trinity Bellwoods Cafe",     "address": "900 Dundas St W, Toronto, ON M6J 1W2",      "phone": "416-555-0109", "email": "tb@cafe.ca",           "contact": "Priya Sharma"},
    {"name": "Ossington Photo Studio",     "address": "69 Ossington Ave, Toronto, ON M6J 2Y9",     "phone": "416-555-0110", "email": "ossi@photo.ca",        "contact": "Jake Moore"},
    {"name": "West Queen West Framing",    "address": "1078 Queen St W, Toronto, ON M6J 1H7",      "phone": "416-555-0111", "email": "wqw@framing.ca",       "contact": "Nadia Volk"},
    {"name": "Leslieville Gear & Coffee",  "address": "891 Queen St E, Toronto, ON M4M 1J3",       "phone": "416-555-0112", "email": "leslieville@gear.ca",  "contact": "Chris Ho"},
    {"name": "Riverside Kitchen Supply",   "address": "1015 Queen St E, Toronto, ON M4M 1K4",      "phone": "416-555-0113", "email": "riverside@kitchen.ca", "contact": "Fiona Bell"},
    {"name": "Beaches Surf & Board",       "address": "2153 Queen St E, Toronto, ON M4E 1E5",      "phone": "416-555-0114", "email": "beaches@surf.ca",      "contact": "Ryan James"},
]

# ── Insert customers ──────────────────────────────────────────────────────────
print(f"Inserting {len(CUSTOMERS)} customers for user {USER_ID}…")
inserted_ids = []

for c in CUSTOMERS:
    record = {
        "user_id":  USER_ID,
        "name":     c["name"],
        "address":  c["address"],
        "phone":    c["phone"],
        "email":    c["email"],
        "contact":  c["contact"],
        "lat":      None,
        "lon":      None,
        "verified": False,
        "source":   "manual",
    }
    result = db.table("customers").insert(record).execute()
    cid = result.data[0]["id"]
    inserted_ids.append(cid)
    print(f"  ✓ {c['name']} ({cid[:8]}…)")
    time.sleep(0.1)

print(f"\n{len(inserted_ids)} customers inserted.")

# ── Insert a saved set route using the first 8 customers ─────────────────────
route_customer_ids = inserted_ids[:8]
print(f"\nCreating saved route 'West Side Morning Run' with {len(route_customer_ids)} stops…")

route_result = db.table("set_routes").insert({
    "user_id":      USER_ID,
    "name":         "West Side Morning Run",
    "customer_ids": route_customer_ids,
    "last_constraints": {
        "priority_stops": route_customer_ids[:2],   # first two are priority
        "time_windows": [
            {"customer_id": route_customer_ids[4], "before": "11:00", "after": None}
        ],
        "agent_notes": None,
    },
    "recurrence":   "weekly:mon,wed,fri",
    "active":       True,
}).execute()
route_id = route_result.data[0]["id"]
print(f"  ✓ Route saved ({route_id[:8]}…)")

# ── Demo instruction string ───────────────────────────────────────────────────
first_two = [CUSTOMERS[0]["name"], CUSTOMERS[1]["name"]]
before_stop = CUSTOMERS[4]["name"]

print(f"""
═══════════════════════════════════════════════════════
 Demo complete! Seed data is in your Supabase database.

 To demo the Personalization Agent, use this instruction:
 ┌──────────────────────────────────────────────────────
 │ Get to {first_two[0]} and {first_two[1]} first —
 │ they open at 8am and want delivery before 9.
 │ {before_stop} needs to be before 11am.
 └──────────────────────────────────────────────────────

 Depot address to use: 460 King St W, Toronto, ON M5V 1L7
═══════════════════════════════════════════════════════
""")
