from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user
from database import get_db

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class SetRouteCreate(BaseModel):
    name: str
    customer_ids: list[str]
    last_constraints: Optional[dict] = None
    recurrence: Optional[str] = None


class SetRouteUpdate(BaseModel):
    name: Optional[str] = None
    customer_ids: Optional[list[str]] = None
    last_constraints: Optional[dict] = None
    recurrence: Optional[str] = None
    active: Optional[bool] = None


class SetRouteOut(BaseModel):
    id: str
    name: str
    customer_ids: list[str]
    last_constraints: Optional[dict]
    recurrence: Optional[str]
    active: bool
    created_at: str


def _row_to_out(row: dict) -> SetRouteOut:
    return SetRouteOut(
        id=str(row["id"]),
        name=row["name"],
        customer_ids=[str(c) for c in (row.get("customer_ids") or [])],
        last_constraints=row.get("last_constraints"),
        recurrence=row.get("recurrence"),
        active=row.get("active", True),
        created_at=str(row["created_at"]),
    )


# ── GET /set-routes ───────────────────────────────────────────────────────────

@router.get("", response_model=list[SetRouteOut])
async def list_set_routes(user=Depends(get_current_user)):
    db = get_db()
    result = (
        db.table("set_routes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_row_to_out(r) for r in result.data]


# ── POST /set-routes ──────────────────────────────────────────────────────────

@router.post("", response_model=SetRouteOut, status_code=201)
async def create_set_route(body: SetRouteCreate, user=Depends(get_current_user)):
    db = get_db()
    record = {
        "user_id": user.id,
        "name": body.name,
        "customer_ids": body.customer_ids,
        "last_constraints": body.last_constraints,
        "recurrence": body.recurrence,
        "active": True,
    }
    result = db.table("set_routes").insert(record).execute()
    return _row_to_out(result.data[0])


# ── PUT /set-routes/{id} ──────────────────────────────────────────────────────

@router.put("/{route_id}", response_model=SetRouteOut)
async def update_set_route(route_id: str, body: SetRouteUpdate, user=Depends(get_current_user)):
    db = get_db()
    existing = db.table("set_routes").select("id").eq("id", route_id).eq("user_id", user.id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Route not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = db.table("set_routes").update(updates).eq("id", route_id).eq("user_id", user.id).execute()
    return _row_to_out(result.data[0])


# ── DELETE /set-routes/{id} ───────────────────────────────────────────────────

@router.delete("/{route_id}")
async def delete_set_route(route_id: str, user=Depends(get_current_user)):
    db = get_db()
    existing = db.table("set_routes").select("id").eq("id", route_id).eq("user_id", user.id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Route not found")

    db.table("set_routes").delete().eq("id", route_id).eq("user_id", user.id).execute()
    return {"deleted": True}
