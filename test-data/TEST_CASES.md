# RanRoute — Demo Test Data

All test cases for the project demo.

---

## TEST 1 — Manual Entry (5 customers)


| # | Name | Contact | Phone | Address |
|---|---|---|---|---|
| 1 | Kensington Market Deli | Rosa Chen | 416-555-0201 | 191 Baldwin St, Toronto, ON M5T 1L4 |
| 2 | Bloor Street Bakery | Ahmed Faruk | 416-555-0202 | 641 Bloor St W, Toronto, ON M6G 1L1 |
| 3 | Little Italy Imports | Maria Rossi | 416-555-0203 | 534 College St, Toronto, ON M6G 1A9 |
| 4 | Trinity Bellwoods Cafe | Priya Sharma | 416-555-0204 | 900 Dundas St W, Toronto, ON M6J 1W2 |
| 5 | Ossington Photo Studio | Jake Moore | 416-555-0205 | 69 Ossington Ave, Toronto, ON M6J 2Y9 |


---

## TEST 2 — Excel Import (5 clean customers)

Use the file: `test-data/customers_clean.csv`

Upload in **Customers → Excel / CSV tab**.
Column mapping will be auto-detected.

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
- Some show up as `verified: false` (orange Unverified badge)
- Background geocoding attempts but mostly fails on the raw addresses
- Click the **"Unverified — edit"** chip on any row to open the inline editor
- The AI Sort normalization agent will also suggest improved versions if these are pasted into AI Sort

---

## TEST 4 — AI Sort (email paste with mixed-quality records)

Suppose we have this unstructured customer like the following:

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


---

## TEST 5 — Plan Route (5 stops with AI constraint)

**Setup:**
- Use the 5 customers from Test 1 

**Step 1 — Select stops:**
- Depot: `460 King St W, Toronto, ON M5V 1L7`
- Select all 5 Test 1 customers

**Step 2 — Start Route without any modifications optimizing solely for minimizing distance:**

**Step 2 — Start the same route with a constraint [Route Starting here at 8am]** 
```
Get to Kensington Market Deli before 9am.
Ossington Photo Studio should be last.
```
