from fastapi import APIRouter, Depends
from auth import get_current_user
from database import get_db

router = APIRouter()


@router.get("/stats")
async def get_stats(user=Depends(get_current_user)):
    """
    Return aggregated savings across all saved route_runs for this user.
    Returns:
      total_runs          : number of optimized routes ever saved
      total_time_saved_s  : cumulative seconds saved vs naive order
      total_dist_saved_m  : cumulative metres saved vs naive order
    """
    db = get_db()
    result = (
        db.table("route_runs")
        .select("total_duration_s, naive_duration_s, total_distance_m, naive_distance_m")
        .eq("user_id", user.id)
        .execute()
    )
    rows = result.data or []
    total_runs = len(rows)
    total_time_saved_s = sum(
        max(0, (r.get("naive_duration_s") or 0) - (r.get("total_duration_s") or 0))
        for r in rows
    )
    total_dist_saved_m = sum(
        max(0, (r.get("naive_distance_m") or 0) - (r.get("total_distance_m") or 0))
        for r in rows
    )
    return {
        "total_runs": total_runs,
        "total_time_saved_s": total_time_saved_s,
        "total_dist_saved_m": total_dist_saved_m,
    }
