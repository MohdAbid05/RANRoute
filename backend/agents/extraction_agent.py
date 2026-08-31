
import os
from agents.base import GraniteAgent
from agents.address_normalizer import normalize_addresses

_SYSTEM_PROMPT = """You are a data extraction assistant. The user will paste unstructured text containing customer records.

Extract every customer you can find and return ONLY a valid JSON object in this exact format — no prose, no markdown, no explanation:

{
  "records": [
    {
      "name": "Business or person name",
      "address": "Full street address",
      "phone": "Phone number or null",
      "email": "Email address or null",
      "contact": "Contact person name or null",
      "confidence": 0.95
    }
  ],
  "unreadable": ["raw snippet that could not be parsed", ...]
}

Rules:
- Set confidence between 0.0 and 1.0. Use < 0.7 for any record where you are uncertain about the name or address.
- If a field is not present in the text, set it to null — never guess or invent values.
- Do NOT include addresses in the unreadable array — only include text snippets that contain no identifiable customer record at all.
- Output ONLY the JSON object. No other text."""

_agent: GraniteAgent | None = None


def get_extraction_agent() -> GraniteAgent:
    global _agent
    if _agent is None:
        _agent = GraniteAgent(system_prompt=_SYSTEM_PROMPT)
    return _agent


def extract_customers(raw_text: str) -> dict:
    """
    Extract customer records from unstructured text, then run a second
    address-normalization pass using the raw text as geographic context.

    Returns { records: [...], unreadable: [...] }
    Each record gains two extra fields:
      address_normalized : the improved address (may equal address if no change)
      address_note       : brief reason the address was changed, or null
    Raises RuntimeError on watsonx failure, ValueError on parse failure.
    """
    agent = get_extraction_agent()
    result = agent.call(raw_text)

    # Validate shape
    if "records" not in result:
        result["records"] = []
    if "unreadable" not in result:
        result["unreadable"] = []

    # Clamp confidence to 0-1
    for rec in result["records"]:
        rec["confidence"] = max(0.0, min(1.0, float(rec.get("confidence", 0.5))))

    # ── Address normalization pass ────────────────────────────────────────────
    # Collect addresses from records that have one
    addresses_to_normalize = [
        rec.get("address") or ""
        for rec in result["records"]
    ]

    if any(a.strip() for a in addresses_to_normalize):
        normalized = normalize_addresses(raw_text, addresses_to_normalize)
        for rec, norm in zip(result["records"], normalized):
            rec["address_normalized"] = norm["normalized"]
            rec["address_changed"]    = norm["changed"]
            rec["address_note"]       = norm["note"]
    else:
        # No addresses to normalize — add empty fields for consistent shape
        for rec in result["records"]:
            rec["address_normalized"] = rec.get("address")
            rec["address_changed"]    = False
            rec["address_note"]       = None

    return result
