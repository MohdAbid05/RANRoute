from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
import io, asyncio
from typing import Optional
import pandas as pd
from models.customer import CustomerCreate, CustomerUpdate, CustomerOut
from utils.geocoding import geocode_address
from auth import get_current_user
from database import get_db

router = APIRouter()

# ── Column-alias map ─────────────────────────────────────────────────────────

_ALIASES: dict[str, list[str]] = {
    "name":    ["name", "business", "company", "customer", "client", "store"],
    "address": ["address", "street", "location", "addr"],
    "phone":   ["phone", "tel", "telephone", "mobile", "cell"],
    "email":   ["email", "e-mail", "mail"],
    "contact": ["contact", "person", "rep", "agent", "contact person"],
}


def _detect_mapping(columns: list[str]) -> dict[str, Optional[int]]:
    lower = [c.lower().strip() for c in columns]
    mapping: dict[str, Optional[int]] = {k: None for k in _ALIASES}
    for field, aliases in _ALIASES.items():
        for alias in aliases:
            if alias in lower:
                mapping[field] = lower.index(alias)
                break
    return mapping


class ImportConfirmBody(BaseModel):
    rows: list[list]
    mapping: dict[str, Optional[int]]


def _row_to_out(row: dict) -> CustomerOut:
    return CustomerOut(
        id=str(row["id"]),
        name=row["name"],
        address=row["address"],
        contact=row.get("contact"),
        phone=row.get("phone"),
        email=row.get("email"),
        lat=row.get("lat"),
        lon=row.get("lon"),
        verified=row.get("verified", False),
        source=row.get("source", "manual"),
        created_at=str(row["created_at"]),
    )


# ── Import preview ────────────────────────────────────────────────────────────

@router.post("/import-preview")
async def import_preview(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    filename = (file.filename or "").lower()
    if not (filename.endswith(".xlsx") or filename.endswith(".xls") or filename.endswith(".csv")):
        raise HTTPException(status_code=400, detail="Please upload an Excel (.xlsx) or CSV (.csv) file")

    contents = await file.read()
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents), dtype=str, keep_default_na=False)
        else:
            df = pd.read_excel(io.BytesIO(contents), dtype=str, engine="openpyxl", keep_default_na=False)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}")

    columns = list(df.columns)
    preview_df = df.head(100)
    rows = [[str(cell) for cell in row] for row in preview_df.values.tolist()]

    detected = _detect_mapping(columns)
    return {"columns": columns, "rows": rows, "detected_mapping": detected}


# ── Import confirm ────────────────────────────────────────────────────────────

async def _geocode_and_update(customer_id: str, address: str):
    """Background task: geocode a single address and update the DB record."""
    try:
        lat, lon, verified = await geocode_address(address)
        if verified:
            db = get_db()
            db.table("customers").update({
                "lat": lat, "lon": lon, "verified": True
            }).eq("id", customer_id).execute()
    except Exception:
        pass


@router.post("/import-confirm")
async def import_confirm(
    body: ImportConfirmBody,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
):
    db = get_db()
    mapping = body.mapping
    name_idx    = mapping.get("name")
    address_idx = mapping.get("address")
    phone_idx   = mapping.get("phone")
    email_idx   = mapping.get("email")
    contact_idx = mapping.get("contact")

    inserted = 0
    skipped_duplicates = 0
    errors: list[str] = []

    def _cell(row: list, idx) -> Optional[str]:
        if idx is None or idx >= len(row):
            return None
        v = str(row[idx]).strip()
        return v if v else None

    for row in body.rows:
        name    = _cell(row, name_idx)
        address = _cell(row, address_idx)

        if not name or not address:
            continue

        phone   = _cell(row, phone_idx)
        email   = _cell(row, email_idx)
        contact = _cell(row, contact_idx)

        # ── Duplicate detection ───────────────────────────────────────────────
        is_dup = False
        if phone:
            res = db.table("customers").select("id").eq("user_id", user.id).eq("phone", phone).limit(1).execute()
            if res.data: is_dup = True
        if not is_dup and email:
            res = db.table("customers").select("id").eq("user_id", user.id).eq("email", email).limit(1).execute()
            if res.data: is_dup = True
        if not is_dup:
            res = db.table("customers").select("id").eq("user_id", user.id).eq("address", address).limit(1).execute()
            if res.data: is_dup = True

        if is_dup:
            skipped_duplicates += 1
            continue

        # ── Insert immediately as unverified ─────────────────────────────────
        record = {
            "user_id": user.id,
            "name": name,
            "address": address,
            "contact": contact,
            "phone": phone,
            "email": email,
            "lat": None,
            "lon": None,
            "verified": False,
            "source": "excel",
        }
        try:
            result = db.table("customers").insert(record).execute()
            inserted += 1
            # Queue background geocoding — does not block the response
            cid = result.data[0]["id"]
            background_tasks.add_task(_geocode_and_update, cid, address)
        except Exception as exc:
            errors.append(str(exc))

    return {
        "inserted": inserted,
        "skipped_duplicates": skipped_duplicates,
        "unverified": inserted,   # all start unverified; background task verifies them
        "errors": errors,
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CustomerOut])
async def list_customers(user=Depends(get_current_user)):
    db = get_db()
    result = (
        db.table("customers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_row_to_out(r) for r in result.data]


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(body: CustomerCreate, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    db = get_db()

    # ── Duplicate detection ──────────────────────────────────────────────────
    conflict_fields: list[str] = []

    if body.phone:
        existing = (
            db.table("customers")
            .select("id")
            .eq("user_id", user.id)
            .eq("phone", body.phone)
            .limit(1)
            .execute()
        )
        if existing.data:
            conflict_fields.append("phone")

    if body.email:
        existing = (
            db.table("customers")
            .select("id")
            .eq("user_id", user.id)
            .eq("email", body.email)
            .limit(1)
            .execute()
        )
        if existing.data:
            conflict_fields.append("email")

    if body.address:
        existing = (
            db.table("customers")
            .select("id")
            .eq("user_id", user.id)
            .eq("address", body.address)
            .limit(1)
            .execute()
        )
        if existing.data:
            conflict_fields.append("address")

    if conflict_fields:
        raise HTTPException(
            status_code=409,
            detail={"detail": "duplicate", "fields": conflict_fields},
        )

    # ── Insert immediately, geocode in background ─────────────────────────────
    record = {
        "user_id": user.id,
        "name": body.name,
        "address": body.address,
        "contact": body.contact,
        "phone": body.phone,
        "email": body.email,
        "lat": None,
        "lon": None,
        "verified": False,
        "source": "manual",
    }
    result = db.table("customers").insert(record).execute()
    cid = result.data[0]["id"]
    background_tasks.add_task(_geocode_and_update, cid, body.address)
    return _row_to_out(result.data[0])


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    body: CustomerUpdate,
    user=Depends(get_current_user),
):
    db = get_db()

    existing = (
        db.table("customers")
        .select("*")
        .eq("id", customer_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Customer not found")

    updates: dict = {k: v for k, v in body.model_dump().items() if v is not None}

    if "address" in updates:
        lat, lon, verified = await geocode_address(updates["address"])
        updates["lat"] = lat
        updates["lon"] = lon
        updates["verified"] = verified

    result = (
        db.table("customers")
        .update(updates)
        .eq("id", customer_id)
        .eq("user_id", user.id)
        .execute()
    )
    return _row_to_out(result.data[0])


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, user=Depends(get_current_user)):
    db = get_db()

    existing = (
        db.table("customers")
        .select("id")
        .eq("id", customer_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Customer not found")

    db.table("customers").delete().eq("id", customer_id).eq("user_id", user.id).execute()
    return {"deleted": True}
