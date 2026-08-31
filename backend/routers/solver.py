from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user
from solver.route_solver import optimize_route
from database import get_db

router = APIRouter()


class TimeWindow(BaseModel):
    customer_id: str
    before: Optional[str] = None   # "HH:MM"
    after:  Optional[str] = None   # "HH:MM"


class ConstraintSet(BaseModel):
    priority_stops: list[str] = []
    time_windows:   list[TimeWindow] = []
    agent_notes:    Optional[str] = None


class OptimizeRequest(BaseModel):
    depot_address: str
    customer_ids:  list[str]
    constraints:   ConstraintSet = ConstraintSet()


@router.post("/optimize")
async def optimize(body: OptimizeRequest, user=Depends(get_current_user)):
    if not body.customer_ids:
        raise HTTPException(status_code=400, detail="customer_ids must not be empty")
    if len(body.customer_ids) > 25:
        raise HTTPException(status_code=400, detail="Maximum 25 stops per route")
    if not body.depot_address.strip():
        raise HTTPException(status_code=400, detail="depot_address is required")

    constraints_dict = {
        "priority_stops": body.constraints.priority_stops,
        "time_windows": [tw.model_dump() for tw in body.constraints.time_windows],
    }

    try:
        result = await optimize_route(
            depot_address=body.depot_address,
            customer_ids=body.customer_ids,
            constraints=constraints_dict,
            user_id=user.id,
        )
        # ── Persist route run for savings stats ───────────────────────────────
        try:
            db = get_db()
            db.table("route_runs").insert({
                "user_id":           user.id,
                "depot_address":     body.depot_address,
                "customer_ids":      body.customer_ids,
                "optimized_order":   result.get("optimized_order", []),
                "constraints":       constraints_dict,
                "total_distance_m":  result.get("total_distance_m"),
                "total_duration_s":  result.get("total_duration_s"),
                "naive_distance_m":  result.get("naive_distance_m"),
                "naive_duration_s":  result.get("naive_duration_s"),
                "status":            "saved",
            }).execute()
        except Exception:
            pass  # never block the response if stats write fails
        return result
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
