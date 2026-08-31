from pydantic import BaseModel


class CustomerCreate(BaseModel):
    name: str
    address: str
    contact: str | None = None
    phone: str | None = None
    email: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    contact: str | None = None
    phone: str | None = None
    email: str | None = None


class CustomerOut(BaseModel):
    id: str
    name: str
    address: str
    contact: str | None
    phone: str | None
    email: str | None
    lat: float | None
    lon: float | None
    verified: bool
    source: str
    created_at: str
