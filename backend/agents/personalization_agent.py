import os
from agents.base import GraniteAgent

_SYSTEM_PROMPT = """You are a route planning assistant. The user will describe delivery stop preferences in plain English.

Extract structured constraints and return ONLY a valid JSON object in this exact format — no prose, no markdown:

{
  "priority_stops": ["customer_id_1", "customer_id_2"],
  "time_windows": [
    { "customer_id": "uuid", "before": "15:00", "after": null }
  ],
  "agent_notes": "Explain here what you could NOT resolve and propose a specific alternative. Set to null if everything is satisfied."
}

Rules:
- priority_stops: list of customer IDs that should be visited early in the route. Use exact IDs from the customer list.
- time_windows: only include entries where the user specified a time. "before" = must arrive before HH:MM. "after" = must arrive after HH:MM. Use null for unspecified.
- agent_notes: if anything could not be resolved, explain what AND propose a specific actionable alternative. Never write a vague "I'll do my best." If all constraints are satisfied, set to null.
- NEVER invent a customer ID. Only use IDs from the provided list. If you cannot confidently match a name to an ID, omit it entirely.
- Output ONLY the JSON object. No other text."""

_agent: GraniteAgent | None = None


def get_personalization_agent() -> GraniteAgent:
    global _agent
    if _agent is None:
        _agent = GraniteAgent(system_prompt=_SYSTEM_PROMPT)
    return _agent


def personalize_route(customers: list[dict], instruction: str) -> dict:
    """
    Translate a plain-English instruction into a structured ConstraintSet.
    Passes only {id, name} to the LLM — never addresses or coordinates.
    Server-side validates all returned IDs against the submitted customer list.

    Returns { priority_stops, time_windows, agent_notes }.
    Raises RuntimeError on watsonx failure, ValueError on JSON parse failure.
    """
    # Build a minimal customer list — never expose addresses to LLM
    customer_list = "\n".join(f"- ID: {c['id']}, Name: {c['name']}" for c in customers)
    user_msg = (
        f"Customer list:\n{customer_list}\n\n"
        f"Routing instruction: {instruction}"
    )

    agent = get_personalization_agent()
    result = agent.call(user_msg)

    # ── Server-side ID validation ──────────────────────────────────────────────
    # Strip any IDs the agent hallucinated that are not in the submitted list
    valid_ids = {c["id"] for c in customers}

    priority = [pid for pid in result.get("priority_stops", []) if pid in valid_ids]
    time_windows = [
        tw for tw in result.get("time_windows", [])
        if tw.get("customer_id") in valid_ids
    ]

    return {
        "priority_stops": priority,
        "time_windows": time_windows,
        "agent_notes": result.get("agent_notes"),
    }
