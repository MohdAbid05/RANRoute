import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from agents.extraction_agent import extract_customers
from agents.personalization_agent import personalize_route
from agents.address_normalizer import normalize_addresses
from auth import get_current_user

router = APIRouter()


class ExtractRequest(BaseModel):
    raw_text: str


class PersonalizeRequest(BaseModel):
    customers: list[dict]   # [{id, name}] — addresses never sent to LLM
    instruction: str


class NormalizeRequest(BaseModel):
    raw_text: str        # original context blob (for city/region clues)
    addresses: list[str] # addresses to normalize


@router.post("/extract-customers")
async def extract_customers_endpoint(body: ExtractRequest, user=Depends(get_current_user)):
    if not body.raw_text or not body.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text is required")
    if len(body.raw_text) > 20000:
        raise HTTPException(
            status_code=400,
            detail="Text too long — paste a smaller block (max 20,000 characters)"
        )
    try:
        result = extract_customers(body.raw_text)
        return result
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="The AI model returned an unexpected response. Try again or paste a smaller block of text."
        )


@router.post("/personalize-route")
async def personalize_route_endpoint(body: PersonalizeRequest, user=Depends(get_current_user)):
    if not body.instruction or not body.instruction.strip():
        raise HTTPException(status_code=400, detail="instruction is required")
    if not body.customers:
        raise HTTPException(status_code=400, detail="customers list must not be empty")
    # Strip any fields beyond id/name before passing to LLM
    safe_customers = [{"id": str(c["id"]), "name": str(c["name"])} for c in body.customers]
    try:
        result = personalize_route(safe_customers, body.instruction)
        return result
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="The AI model returned an unexpected response. Try again or use simpler instructions."
        )


@router.post("/normalize-addresses")
async def normalize_addresses_endpoint(body: NormalizeRequest, user=Depends(get_current_user)):
    """
    Standalone address normalization — useful when the user wants to fix
    a single address on an existing customer record.
    Returns [{ original, normalized, changed, note }]
    """
    if not body.addresses:
        raise HTTPException(status_code=400, detail="addresses list must not be empty")
    try:
        result = normalize_addresses(body.raw_text or "", body.addresses)
        return result
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
