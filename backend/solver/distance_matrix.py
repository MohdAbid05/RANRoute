import os
import httpx

_GMAPS_BASE = "https://maps.googleapis.com/maps/api/distancematrix/json"
_GMAPS_GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json"


def _api_key() -> str:
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not key:
        raise EnvironmentError("GOOGLE_MAPS_API_KEY is not set")
    return key


async def geocode_address_gmaps(address: str) -> tuple[float | None, float | None]:
    """Geocode a single address using Google Maps Geocoding API."""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            _GMAPS_GEOCODE_BASE,
            params={"address": address, "key": _api_key()},
            timeout=10,
        )
        data = r.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return loc["lat"], loc["lng"]
    return None, None


async def get_distance_matrix(
    locations: list[tuple[float, float]],
) -> tuple[list[list[int]], list[list[int]]]:
    """
    Call Google Maps Distance Matrix API for an NxN matrix of all locations.
    locations: list of (lat, lon) tuples, depot first.
    Returns (duration_matrix_seconds, distance_matrix_meters).
    Each row i contains travel times/distances from location i to all others.
    """
    key = _api_key()
    coords = [f"{lat},{lon}" for lat, lon in locations]
    # Google allows up to 25 origins × 25 destinations per request
    # We stay within the 25-stop cap enforced by the solver
    origins = "|".join(coords)
    destinations = "|".join(coords)

    async with httpx.AsyncClient() as client:
        r = await client.get(
            _GMAPS_BASE,
            params={
                "origins": origins,
                "destinations": destinations,
                "mode": "driving",
                "key": key,
            },
            timeout=30,
        )
        data = r.json()

    if data.get("status") != "OK":
        raise RuntimeError(f"Distance Matrix API error: {data.get('status')} — {data.get('error_message', '')}")

    n = len(locations)
    duration_matrix = [[0] * n for _ in range(n)]
    distance_matrix = [[0] * n for _ in range(n)]

    for i, row in enumerate(data["rows"]):
        for j, element in enumerate(row["elements"]):
            if element["status"] == "OK":
                duration_matrix[i][j] = element["duration"]["value"]   # seconds
                distance_matrix[i][j] = element["distance"]["value"]   # metres
            else:
                # If a pair is unavailable, use a large penalty so OR-Tools avoids it
                duration_matrix[i][j] = 999999
                distance_matrix[i][j] = 999999

    return duration_matrix, distance_matrix
