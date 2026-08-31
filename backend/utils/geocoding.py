import asyncio
import httpx

_HEADERS = {"User-Agent": "RANRoute-Everywhere/1.0 (hackathon demo)"}
_TIMEOUT = 8


async def _nominatim_query(client: httpx.AsyncClient, address: str):
    """Single Nominatim call. Returns (lat, lon) or (None, None)."""
    try:
        r = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "json", "limit": 1},
            headers=_HEADERS,
            timeout=_TIMEOUT,
        )
        data = r.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return None, None


def _address_variants(address: str) -> list[str]:
    """
    Generate fallback variants to try when the raw address fails.
    Handles common issues with Nominatim strictness.
    """
    variants = [address]

    # Fix common apostrophe omissions in city names
    # e.g. "St. Johns" → "St. John's", "St Johns" → "St. John's"
    import re as _re
    apostrophe_fixes = [
        (r"St\.?\s*Johns", "St. John's"),
        (r"Saint\s*Johns", "Saint John's"),
    ]
    fixed = address
    for pattern, replacement in apostrophe_fixes:
        fixed = _re.sub(pattern, replacement, fixed, flags=_re.IGNORECASE)
    if fixed != address:
        variants.insert(1, fixed)

    # Add Canada if no country hint present
    low = address.lower()
    if "canada" not in low:
        variants.append(address + ", Canada")
        if fixed != address:
            variants.append(fixed + ", Canada")

    # Expand common Canadian province abbreviations
    replacements = [
        ("NL", "Newfoundland and Labrador"),
        ("NS", "Nova Scotia"),
        ("NB", "New Brunswick"),
        ("PE", "Prince Edward Island"),
        ("QC", "Quebec"),
        ("ON", "Ontario"),
        ("MB", "Manitoba"),
        ("SK", "Saskatchewan"),
        ("AB", "Alberta"),
        ("BC", "British Columbia"),
        ("YT", "Yukon"),
        ("NT", "Northwest Territories"),
        ("NU", "Nunavut"),
        # US states most likely for small business users
        ("NY", "New York"),
        ("CA", "California"),
        ("TX", "Texas"),
        ("FL", "Florida"),
        ("IL", "Illinois"),
    ]
    for abbr, full in replacements:
        # Match ", NL" or " NL," patterns (word boundary)
        import re
        pattern = re.compile(r'(?<![A-Z])' + abbr + r'(?![A-Z])')
        if pattern.search(address):
            expanded = pattern.sub(full, address) + ", Canada"
            variants.append(expanded)
            break

    # Strip unit numbers (e.g. "Suite 4, 123 Main St" → "123 Main St")
    import re
    stripped = re.sub(r'(?i)(suite|apt|unit|#)\s*\w+[,\s]+', '', address).strip().strip(',').strip()
    if stripped != address:
        variants.append(stripped)
        variants.append(stripped + ", Canada")

    # Remove duplicates while preserving order
    seen = set()
    unique = []
    for v in variants:
        if v not in seen:
            seen.add(v)
            unique.append(v)
    return unique


async def geocode_address(address: str) -> tuple[float | None, float | None, bool]:
    """
    Try to geocode an address using Nominatim with fallback variants.
    Rate-limited to 1 req/s per Nominatim ToS.
    Returns (lat, lon, verified).
    """
    if not address or not address.strip():
        return None, None, False

    variants = _address_variants(address)

    async with httpx.AsyncClient() as client:
        for i, variant in enumerate(variants):
            if i > 0:
                await asyncio.sleep(1)  # rate limit between retries
            else:
                await asyncio.sleep(1)  # always wait 1s before first call too

            lat, lon = await _nominatim_query(client, variant)
            if lat is not None:
                return lat, lon, True

    return None, None, False
