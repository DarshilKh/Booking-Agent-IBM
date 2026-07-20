from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator

from models import BookingStatus, UserRole


def _as_utc(v: datetime) -> datetime:
    """SQLite has no real timezone storage - even with DateTime(timezone=True),
    values come back from the DB naive. Every datetime this API stores or
    reads is UTC (we always write datetime.now(timezone.utc) or a client's
    already-UTC ISO timestamp), so if it comes back naive we just tag it as
    UTC rather than leaving it ambiguous. Without this, FastAPI serializes a
    naive datetime with no 'Z'/offset suffix, and browsers then parse that
    string as *local* time - silently shifting every booking by the reader's
    UTC offset (e.g. a 1pm IST booking would render as ~7:30am)."""
    if v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# Booking schemas (unchanged from before)
# ---------------------------------------------------------------------------
class BookingCreate(BaseModel):
    customer_name: str
    customer_email: EmailStr
    customer_phone: Optional[str] = None
    reason: str
    start_time: datetime
    end_time: datetime

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v, info):
        start = info.data.get("start_time")
        if start and v <= start:
            raise ValueError("end_time must be after start_time")
        return v


class StatusUpdate(BaseModel):
    status: BookingStatus


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_name: str
    customer_email: str
    customer_phone: Optional[str] = None
    reason: str
    start_time: datetime
    end_time: datetime
    status: str
    created_at: datetime

    @field_validator("start_time", "end_time", "created_at", mode="after")
    @classmethod
    def tag_utc(cls, v):
        return _as_utc(v)


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------
class UserSignup(BaseModel):
    email: EmailStr
    password: str
    role: UserRole = UserRole.STAFF


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    role: str
    created_at: datetime

    @field_validator("created_at", mode="after")
    @classmethod
    def tag_utc(cls, v):
        return _as_utc(v)


# ---------------------------------------------------------------------------
# Public customer chat schemas
# ---------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class PublicChatRequest(BaseModel):
    messages: list[ChatMessage]


class PublicChatResponse(BaseModel):
    reply: str
    booking: Optional[BookingRead] = None


# ---------------------------------------------------------------------------
# AI agent schemas
# ---------------------------------------------------------------------------
class AgentQuery(BaseModel):
    query: str


class AgentResponse(BaseModel):
    intent: str
    entities: dict
    message: str
    result: Optional[dict] = None
