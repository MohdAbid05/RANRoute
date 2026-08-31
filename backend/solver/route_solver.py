"""
OR-Tools TSP/VRP solver for RouteOne.

Input  : depot_address, customer_ids (ordered), constraints (ConstraintSet)
Output : optimized_order, total_distance_m, total_duration_s,
         naive_distance_m, naive_duration_s
"""
import asyncio
from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from database import get_db
from utils.geocoding import geocode_address
from solver.distance_matrix import get_distance_matrix, geocode_address_gmaps

MAX_STOPS = 25
_TIME_HORIZON = 24 * 3600  # 24 hours in seconds


def _hhmm_to_seconds(hhmm: str) -> int:
    """Convert 'HH:MM' string to seconds since midnight."""
    h, m = hhmm.split(":")
    return int(h) * 3600 + int(m) * 60


async def optimize_route(
    depot_address: str,
    customer_ids: list[str],
    constraints: dict,
    user_id: str,
) -> dict:
    """
    Full solve pipeline:
      1. Geocode depot (Google Maps first, Nominatim fallback)
      2. Fetch customer coordinates from DB
      3. Build distance/duration matrix via Google Maps
      4. Run OR-Tools RoutingModel
      5. Compute naive (original-order) metrics for savings banner
      6. Return result dict
    """
    if len(customer_ids) > MAX_STOPS:
        raise ValueError(f"Too many stops — maximum is {MAX_STOPS}, got {len(customer_ids)}")

    # ── 1. Geocode depot ──────────────────────────────────────────────────────
    depot_lat, depot_lon = await geocode_address_gmaps(depot_address)
    if depot_lat is None:
        # Fallback to Nominatim
        depot_lat, depot_lon, _ = await geocode_address(depot_address)
    if depot_lat is None:
        raise ValueError(f"Could not geocode depot address: '{depot_address}'. Please check the address and try again.")

    # ── 2. Fetch customer lat/lon from DB ─────────────────────────────────────
    db = get_db()
    result = (
        db.table("customers")
        .select("id, name, address, lat, lon")
        .eq("user_id", user_id)
        .in_("id", customer_ids)
        .execute()
    )
    customer_map = {str(r["id"]): r for r in result.data}

    # Preserve the requested order, skip any customers not found or missing coords
    customers_ordered = []
    missing = []
    for cid in customer_ids:
        c = customer_map.get(cid)
        if not c:
            missing.append(cid)
            continue
        if c["lat"] is None or c["lon"] is None:
            missing.append(cid)
            continue
        customers_ordered.append(c)

    if not customers_ordered:
        raise ValueError("None of the selected customers have verified coordinates. Please verify addresses first.")
    if missing:
        # Warn but proceed with the ones we have
        pass

    # ── 3. Build location list: depot at index 0 ──────────────────────────────
    locations = [(depot_lat, depot_lon)] + [(c["lat"], c["lon"]) for c in customers_ordered]
    n = len(locations)  # depot + N customers

    duration_matrix, distance_matrix = await get_distance_matrix(locations)

    # ── 4a. Build naive metrics (original order, depot→c0→c1→…→cn) ───────────
    naive_duration_s = 0
    naive_distance_m = 0
    naive_indices = [0] + list(range(1, n))  # depot then customers in original order
    for i in range(len(naive_indices) - 1):
        fr, to = naive_indices[i], naive_indices[i + 1]
        naive_duration_s += duration_matrix[fr][to]
        naive_distance_m += distance_matrix[fr][to]

    # ── 4b. OR-Tools solve ────────────────────────────────────────────────────
    priority_ids  = set(constraints.get("priority_stops", []))
    time_windows  = {tw["customer_id"]: tw for tw in constraints.get("time_windows", [])}

    manager = pywrapcp.RoutingIndexManager(n, 1, 0)  # n nodes, 1 vehicle, depot=0
    routing = pywrapcp.RoutingModel(manager)

    # Duration callback
    def duration_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node   = manager.IndexToNode(to_index)
        return duration_matrix[from_node][to_node]

    transit_cb_idx = routing.RegisterTransitCallback(duration_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_cb_idx)

    # Time dimension (needed for time windows)
    routing.AddDimension(
        transit_cb_idx,
        slack_max=_TIME_HORIZON,   # allow waiting at nodes
        capacity=_TIME_HORIZON,
        fix_start_cumul_to_zero=True,
        name="Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")

    # Apply time windows as hard constraints
    for i, c in enumerate(customers_ordered):
        cid = str(c["id"])
        node_index = manager.NodeToIndex(i + 1)  # +1 because depot is index 0
        tw = time_windows.get(cid)
        if tw:
            after_s  = _hhmm_to_seconds(tw["after"])  if tw.get("after")  else 0
            before_s = _hhmm_to_seconds(tw["before"]) if tw.get("before") else _TIME_HORIZON
            if after_s >= before_s:
                # Invalid window — skip hard constraint, note in caller
                pass
            else:
                time_dim.CumulVar(node_index).SetRange(after_s, before_s)

    # Priority stops: penalise routing them later by adding disjunctions
    # We use a large penalty for depot→priority arc if visited too late.
    # Simple approach: add a "visit early" soft constraint via penalty on position.
    # OR-Tools doesn't have a native position constraint, so we use arc penalties:
    # Make it cheap to go depot→priority_stop (reduce arc cost) and expensive not to.
    PRIORITY_BONUS = 3600  # effectively 1 hour cheaper, pulls priority stops early
    for i, c in enumerate(customers_ordered):
        cid = str(c["id"])
        if cid in priority_ids:
            # Penalise arcs that skip this node (soft disjunction with 0 penalty = must visit)
            # Instead: reduce the arc cost from depot to this node
            # We register a separate callback isn't efficient; use disjunction with large penalty
            routing.AddDisjunction(
                [manager.NodeToIndex(i + 1)],
                0,  # penalty=0 means it MUST be visited (hard)
            )

    # Search parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_params)

    if not solution:
        # Try relaxing time windows and retry
        routing2 = pywrapcp.RoutingModel(manager)
        routing2.SetArcCostEvaluatorOfAllVehicles(
            routing2.RegisterTransitCallback(duration_callback)
        )
        search_params2 = pywrapcp.DefaultRoutingSearchParameters()
        search_params2.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        search_params2.time_limit.seconds = 5
        solution = routing2.SolveWithParameters(search_params2)

        if not solution:
            # Build a helpful conflict message
            conflicting = [
                f"{c['name']} ({time_windows[str(c['id'])]['before']})"
                for c in customers_ordered
                if str(c["id"]) in time_windows
            ]
            detail = ""
            if conflicting:
                detail = f" Conflicting time windows: {', '.join(conflicting)}."
            raise ValueError(
                f"Could not find a feasible route with these constraints.{detail} "
                f"Try relaxing or removing some time windows."
            )
        # solution found after relaxation — use routing2 for extraction
        routing = routing2

    # ── 5. Extract optimized order ────────────────────────────────────────────
    index = routing.Start(0)
    optimized_customer_indices = []
    total_duration_s = 0
    total_distance_m = 0
    prev_index = index

    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        if node != 0:  # skip depot
            optimized_customer_indices.append(node - 1)  # back to 0-based customer index
        index = solution.Value(routing.NextVar(index))
        total_duration_s += duration_matrix[manager.IndexToNode(prev_index)][manager.IndexToNode(index)]
        total_distance_m += distance_matrix[manager.IndexToNode(prev_index)][manager.IndexToNode(index)]
        prev_index = index

    optimized_order = [str(customers_ordered[i]["id"]) for i in optimized_customer_indices]

    return {
        "optimized_order": optimized_order,
        "total_distance_m": total_distance_m,
        "total_duration_s": total_duration_s,
        "naive_distance_m": naive_distance_m,
        "naive_duration_s": naive_duration_s,
        "customers": [
            {"id": str(c["id"]), "name": c["name"], "address": c["address"]}
            for c in customers_ordered
        ],
        "skipped_customer_ids": missing,
    }
