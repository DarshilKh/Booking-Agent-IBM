from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from database import init_db, get_session
from models import Booking, BookingStatus, User, UserRole
from schemas import (
    BookingCreate, BookingRead, StatusUpdate,
    UserSignup, UserLogin, TokenResponse, UserRead,
    AgentQuery, AgentResponse,
    ChatMessage, PublicChatRequest, PublicChatResponse,
)
from notifications import notify_booking_created, notify_booking_accepted, notify_booking_rejected
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin_jwt_or_key,
)
from agent import detect_intent, NOT_IMPLEMENTED_INTENTS, run_customer_chat


# ---------------------------------------------------------------------------
# Startup: create the database file/tables automatically
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title=f"{settings.BUSINESS_NAME} Booking API", lifespan=lifespan)

# ---------------------------------------------------------------------------
# CORS - lets a frontend hosted on a different origin (e.g. your Vercel
# deployment) call this API from the browser. Configure allowed origins via
# the CORS_ORIGINS env var (comma-separated). Falls back to "*" for local
# dev if not set.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@app.post("/auth/signup", response_model=UserRead, status_code=201)
async def signup(
    payload: UserSignup,
    session: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin_jwt_or_key),
):
    """
    Create a new staff/admin login. Protected by the admin key (or an
    existing admin's JWT) so random people can't create their own admin
    accounts - only someone who already has access can add teammates.
    """
    existing = await session.execute(select(User).where(User.email == payload.email))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="A user with that email already exists")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role.value,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@app.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.email == payload.email))
    user = result.scalars().first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return TokenResponse(access_token=token)


@app.get("/auth/me", response_model=UserRead)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


# ---------------------------------------------------------------------------
# Booking business logic (shared by REST routes and the AI agent)
# ---------------------------------------------------------------------------
async def _check_slot_free(session: AsyncSession, start_time, end_time) -> bool:
    result = await session.execute(
        select(Booking).where(
            Booking.status.in_([BookingStatus.PENDING.value, BookingStatus.ACCEPTED.value]),
            Booking.start_time < end_time,
            Booking.end_time > start_time,
        )
    )
    return result.scalars().first() is None


async def _create_booking(session: AsyncSession, background_tasks: BackgroundTasks, payload: BookingCreate) -> Booking:
    start_time = payload.start_time
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    if start_time <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="That time has already passed. Please choose a future time.")

    if not await _check_slot_free(session, payload.start_time, payload.end_time):
        raise HTTPException(status_code=409, detail="That time slot is already booked")

    booking = Booking(
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        reason=payload.reason,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status=BookingStatus.PENDING.value,
    )
    session.add(booking)
    await session.commit()
    await session.refresh(booking)
    background_tasks.add_task(notify_booking_created, booking)
    return booking


async def _cancel_booking(session: AsyncSession, booking_id: str) -> Booking:
    booking = await session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking.status = BookingStatus.CANCELLED.value
    session.add(booking)
    await session.commit()
    await session.refresh(booking)
    return booking


async def _reschedule_booking(session: AsyncSession, booking_id: str, new_start, new_end) -> Booking:
    booking = await session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not await _check_slot_free(session, new_start, new_end):
        raise HTTPException(status_code=409, detail="That new time slot is already booked")
    booking.start_time = new_start
    booking.end_time = new_end
    session.add(booking)
    await session.commit()
    await session.refresh(booking)
    return booking


# ---------------------------------------------------------------------------
# Booking routes
# ---------------------------------------------------------------------------
@app.post("/bookings", response_model=BookingRead, status_code=201)
async def create_booking(
    payload: BookingCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    """Customer creates a booking. Anyone can call this - no admin key needed."""
    return await _create_booking(session, background_tasks, payload)


@app.get("/bookings", response_model=List[BookingRead])
async def list_bookings(
    status_filter: Optional[BookingStatus] = Query(default=None, alias="status"),
    session: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin_jwt_or_key),
):
    """Business owner views all bookings. Requires admin key OR admin JWT."""
    query = select(Booking).order_by(Booking.start_time)
    if status_filter:
        query = query.where(Booking.status == status_filter.value)
    result = await session.execute(query)
    return result.scalars().all()


@app.get("/bookings/{booking_id}", response_model=BookingRead)
async def get_booking(booking_id: str, session: AsyncSession = Depends(get_session)):
    booking = await session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@app.patch("/bookings/{booking_id}/status", response_model=BookingRead)
async def update_status(
    booking_id: str,
    payload: StatusUpdate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin_jwt_or_key),
):
    """Business owner accepts/rejects/cancels a booking. Requires admin key OR admin JWT."""
    booking = await session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = payload.status.value
    session.add(booking)
    await session.commit()
    await session.refresh(booking)

    if payload.status == BookingStatus.ACCEPTED:
        background_tasks.add_task(notify_booking_accepted, booking)
    elif payload.status == BookingStatus.REJECTED:
        background_tasks.add_task(notify_booking_rejected, booking)

    return booking


@app.delete("/bookings/{booking_id}", status_code=204)
async def delete_booking(
    booking_id: str,
    session: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin_jwt_or_key),
):
    booking = await session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await session.delete(booking)
    await session.commit()


# ---------------------------------------------------------------------------
# AI agent route
# ---------------------------------------------------------------------------
@app.post("/agent/query", response_model=AgentResponse)
async def agent_query(
    payload: AgentQuery,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Takes a natural-language request, asks Groq to classify intent +
    extract entities, then executes the matching backend operation.
    Requires a logged-in user (JWT) - matches the flow diagram's
    "Authenticate User (JWT)" step before the agent runs.
    """
    parsed = await detect_intent(payload.query)
    intent = parsed.get("intent", "unknown")
    entities = parsed.get("entities", {})
    message = parsed.get("message", "")

    result = None

    if intent == "book_appointment":
        try:
            booking_payload = BookingCreate(
                customer_name=entities.get("customer_name") or current_user.email,
                customer_email=entities.get("customer_email") or current_user.email,
                reason=entities.get("reason") or "Not specified",
                start_time=entities["start_time"],
                end_time=entities["end_time"],
            )
        except Exception:
            return AgentResponse(intent=intent, entities=entities,
                                  message="I need a valid start and end time to book this - could you specify them?")
        booking = await _create_booking(session, background_tasks, booking_payload)
        result = {"booking_id": booking.id, "status": booking.status}

    elif intent == "cancel_appointment":
        booking_id = entities.get("booking_id")
        if not booking_id:
            message = "I need the booking ID to cancel it - do you have it?"
        else:
            booking = await _cancel_booking(session, booking_id)
            result = {"booking_id": booking.id, "status": booking.status}

    elif intent == "reschedule_appointment":
        booking_id = entities.get("booking_id")
        if not booking_id or not entities.get("start_time") or not entities.get("end_time"):
            message = "I need the booking ID plus a new start and end time to reschedule."
        else:
            booking = await _reschedule_booking(session, booking_id, entities["start_time"], entities["end_time"])
            result = {
                "booking_id": booking.id,
                "start_time": booking.start_time.replace(tzinfo=timezone.utc).isoformat(),
                "end_time": booking.end_time.replace(tzinfo=timezone.utc).isoformat(),
            }

    elif intent == "check_availability":
        if not entities.get("start_time") or not entities.get("end_time"):
            message = "What time range would you like me to check?"
        else:
            free = await _check_slot_free(session, entities["start_time"], entities["end_time"])
            result = {"available": free}
            message = "That slot is available." if free else "Sorry, that slot is already booked."

    elif intent == "list_my_bookings":
        query = select(Booking).where(Booking.customer_email == current_user.email).order_by(Booking.start_time)
        rows = (await session.execute(query)).scalars().all()
        result = {"bookings": [{"id": b.id, "status": b.status, "start_time": str(b.start_time)} for b in rows]}

    elif intent in NOT_IMPLEMENTED_INTENTS:
        message = NOT_IMPLEMENTED_INTENTS[intent]

    else:
        message = message or "Sorry, I didn't understand that request."

    return AgentResponse(intent=intent, entities=entities, message=message, result=result)


# ---------------------------------------------------------------------------
# Public customer chat - no login. This is what the customer-facing chat
# widget talks to. It's a real multi-turn conversation (the model decides
# when it has enough info and when to check availability / book), unlike
# the single-shot staff agent above.
# ---------------------------------------------------------------------------
@app.post("/public/chat", response_model=PublicChatResponse)
async def public_chat(
    payload: PublicChatRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    def _local_to_utc(value: str) -> datetime:
        """The agent always sends IST wall-clock time (e.g. "2pm" -> "2026-07-20T14:00:00").
        Interpret it as IST (the clinic's fixed timezone) and convert to UTC for
        storage/comparison. This is intentionally hardcoded, not browser-dependent.
        """
        naive = datetime.fromisoformat(value)
        if naive.tzinfo is not None:
            naive = naive.replace(tzinfo=None)
        return naive.replace(tzinfo=ZoneInfo(settings.CLINIC_TZ)).astimezone(timezone.utc)

    checked_available_slots = []  # (start_utc, end_utc) tuples confirmed free via check_availability

    async def execute_tool(name: str, args: dict) -> dict:
        if name == "check_availability":
            try:
                start = _local_to_utc(args["start_time"])
                end = _local_to_utc(args["end_time"])
            except (KeyError, ValueError):
                return {"error": "invalid start_time/end_time"}
            if start <= datetime.now(timezone.utc):
                return {"error": "That time has already passed. Ask the customer for a future time."}
            free = await _check_slot_free(session, start, end)
            if free:
                checked_available_slots.append((start, end))
            return {"available": free}

        if name == "book_appointment":
            try:
                start = _local_to_utc(args["start_time"])
                end = _local_to_utc(args["end_time"])
            except Exception as e:
                return {"error": f"missing or invalid start_time/end_time: {e}"}

            if (start, end) not in checked_available_slots:
                return {
                    "error": (
                        "You haven't confirmed this exact time is available yet. Call "
                        "check_availability with this exact start_time/end_time first, and "
                        "make sure the customer has explicitly agreed to it, before booking."
                    )
                }

            try:
                booking_payload = BookingCreate(
                    customer_name=args["customer_name"],
                    customer_email=args["customer_email"],
                    customer_phone=args.get("customer_phone"),
                    reason=args["reason"],
                    start_time=start,
                    end_time=end,
                )
            except Exception as e:
                return {"error": f"missing or invalid booking details: {e}"}
            try:
                booking = await _create_booking(session, background_tasks, booking_payload)
            except HTTPException as e:
                return {"error": e.detail}
            return BookingRead.model_validate(booking).model_dump(mode="json")

        return {"error": f"unknown tool {name}"}

    history = [m.model_dump() for m in payload.messages]
    reply, booking_dict = await run_customer_chat(history, execute_tool)
    return PublicChatResponse(reply=reply, booking=booking_dict)
