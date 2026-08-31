import os
from agents.base import GraniteAgent

_SYSTEM_PROMPT = """You are an address normalization assistant for a delivery route planner.

You will receive:
1. The original raw text the user pasted (for geographic context — city names, regions, landmarks mentioned)
2. A list of extracted addresses that may be incomplete, abbreviated, or informal

Your job: for each address, produce the most geocodable, complete version using context clues from the raw text.

Return ONLY a valid JSON array — no prose, no markdown:

[
  {
    "original": "the exact address string you were given",
    "normalized": "the improved full address with street number, street name, city, province/state",
    "changed": true,
    "note": "brief reason for the change, or null if unchanged"
  }
]

Rules:
- If the raw text mentions a city, province, or country anywhere, apply it to addresses that are missing that info.
- Expand abbreviations: "St" → "Street", "Ave" → "Avenue", "Blvd" → "Boulevard", "ON" → keep as province abbreviation (geocoders handle it), etc.
- If an address has only a street name and no number, keep it but set changed: false — do not invent a number.
- If an address is already complete and geocodable, return it unchanged with changed: false and note: null.
- If you genuinely cannot improve an address, return it unchanged.
- NEVER invent street numbers, postal codes, or place names that are not in the original text or raw context.
- Output ONLY the JSON array. No other text."""

_agent: GraniteAgent | None = None


def get_normalizer_agent() -> GraniteAgent:
    global _agent
    if _agent is None:
        _agent = GraniteAgent(system_prompt=_SYSTEM_PROMPT)
    return _agent


def normalize_addresses(raw_text: str, addresses: list[str]) -> list[dict]:
    """
    Use Granite to normalize a list of extracted addresses using the raw text as context.

    raw_text  : the original unstructured text the user pasted (provides city/region context)
    addresses : list of address strings to normalize

    Returns a list of { original, normalized, changed, note } dicts.
    Falls back to returning addresses unchanged on any failure — never crashes the caller.
    """
    if not addresses:
        return []

    # Build the user message — raw text context first, then the address list
    address_list = "\n".join(f"- {a}" for a in addresses)
    # Truncate raw_text context to 3000 chars to avoid huge prompts
    context_snippet = raw_text[:3000] + ("…" if len(raw_text) > 3000 else "")

    user_msg = (
        f"Raw text context (use for geographic clues):\n{context_snippet}\n\n"
        f"Addresses to normalize:\n{address_list}"
    )

    agent = get_normalizer_agent()
    try:
        result = agent.call(user_msg)
        # result should be a list — GraniteAgent.call() returns a dict, but we
        # instruct the model to return an array. Handle both cases.
        if isinstance(result, list):
            normalized = result
        elif isinstance(result, dict) and "normalized" in result:
            # Model returned a single object instead of a list
            normalized = [result]
        else:
            raise ValueError("Unexpected shape")

        # Validate each entry has required keys; fill defaults if missing
        output = []
        for i, addr in enumerate(addresses):
            entry = normalized[i] if i < len(normalized) else {}
            output.append({
                "original":   entry.get("original",   addr),
                "normalized": entry.get("normalized", addr),
                "changed":    bool(entry.get("changed", False)),
                "note":       entry.get("note"),
            })
        return output

    except Exception:
        # Non-fatal — return all addresses unchanged
        return [{"original": a, "normalized": a, "changed": False, "note": None} for a in addresses]
