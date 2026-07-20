"""
Groq AI agent layer.

Takes a natural-language query from the user, asks Groq to classify the
intent and pull out any relevant entities (dates, times, reason, etc.),
and returns structured JSON the backend can act on.

Kept deliberately simple: one prompt, one call, no multi-step agent loop,
no tool-calling framework. Good enough for a college project; can be
made more sophisticated later if you need it.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from groq import AsyncGroq

from config import settings

logger = logging.getLogger(__name__)

client = AsyncGroq(api_key=settings.GROQ_API_KEY)

# Intents the agent is allowed to return. Anything else gets mapped to "unknown".
SUPPORTED_INTENTS = [
    "book_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "check_availability",
    "list_my_bookings",
    "unknown",
]

# Intents mentioned in the project's flow diagram that don't have a real
# data model behind them yet. Rather than letting the AI invent medical
# information, we recognize the intent but return an honest "not available"
# message instead of a real answer.
NOT_IMPLEMENTED_INTENTS = {
    "fetch_prescription": "Prescription lookup isn't implemented yet - there's no prescription data stored in this system.",
    "disease_lookup": "Disease lookup isn't implemented yet - this system doesn't have a medical knowledge base connected.",
    "medicine_lookup": "Medicine lookup isn't implemented yet - this system doesn't have a medicine database connected.",
    "emergency_check": "Emergency triage isn't implemented yet. If this is a real emergency, please contact emergency services directly.",
    "send_reminder": "Automatic reminders aren't implemented yet - bookings only send an email on creation and on accept/reject.",
}

def _build_system_prompt() -> str:
    now = datetime.now(timezone.utc)
    return f"""You are an intent-classification assistant for a clinic booking system.

The current real date and time is: {now.strftime('%A, %Y-%m-%d %H:%M')} (UTC).
Use this to resolve relative dates like "tomorrow", "next Monday", "in 2 hours" etc.
Never guess a year from your training data - always base it on the current date given above.

Given a user's message, respond with ONLY a JSON object (no other text, no markdown fences) with this exact shape:
{{
  "intent": "<one of: {', '.join(SUPPORTED_INTENTS + list(NOT_IMPLEMENTED_INTENTS.keys()))}>",
  "entities": {{
    "customer_name": "<string or null>",
    "customer_email": "<string or null>",
    "reason": "<string or null>",
    "start_time": "<ISO 8601 datetime string or null>",
    "end_time": "<ISO 8601 datetime string or null>",
    "booking_id": "<string or null>"
  }},
  "message": "<a short, friendly one-sentence reply to show the user>"
}}

Rules:
- Only use dates/times the user actually mentioned or clearly implied. Don't invent a date/time if none was given - leave it null.
- If the message doesn't clearly match a supported intent, use "unknown".
- Never include any medical advice, diagnosis, or treatment information in "message" - that's out of scope for this system.
"""


async def detect_intent(user_query: str) -> dict:
    """Calls Groq and returns a parsed dict: {intent, entities, message}."""
    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": _build_system_prompt()},
                {"role": "user", "content": user_query},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        parsed = json.loads(raw)

        # Basic shape safety - don't trust the model blindly
        parsed.setdefault("entities", {})
        parsed.setdefault("message", "")
        if "intent" not in parsed:
            parsed["intent"] = "unknown"

        # If the user gave a start time but no end time, default to a
        # 30-minute appointment instead of forcing them to state both.
        entities = parsed["entities"]
        if entities.get("start_time") and not entities.get("end_time"):
            try:
                start = datetime.fromisoformat(entities["start_time"])
                entities["end_time"] = (start + timedelta(minutes=30)).isoformat()
            except ValueError:
                pass

        return parsed

    except json.JSONDecodeError:
        logger.error("Groq returned non-JSON output: %s", raw)
        return {"intent": "unknown", "entities": {}, "message": "Sorry, I couldn't understand that request."}
    except Exception as e:
        logger.error("Groq call failed: %s", e)
        return {"intent": "unknown", "entities": {}, "message": "The AI agent is temporarily unavailable."}


# ---------------------------------------------------------------------------
# Customer-facing conversational booking agent
#
# Unlike detect_intent() above (a single-shot classifier used by the staff
# assistant, which expects one message to contain everything), this is a
# real multi-turn chat: it greets, asks follow-up questions, checks slot
# availability, and books - using Groq's tool-calling so the model decides
# *when* it has enough information to act, instead of us guessing from one
# message. No login required; this is what anonymous customers talk to.
# ---------------------------------------------------------------------------

CUSTOMER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check whether a given time slot is free before offering it to the customer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_time": {"type": "string", "description": "ISO 8601 datetime, in IST (India Standard Time, no UTC offset), e.g. 2026-07-20T14:00:00"},
                    "end_time": {"type": "string", "description": "ISO 8601 datetime, in IST (India Standard Time, no UTC offset), e.g. 2026-07-20T14:30:00"},
                },
                "required": ["start_time", "end_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": (
                "Create the appointment once you have confirmed name, email, reason, and a free "
                "time slot with the customer. Only call this after the customer has explicitly "
                "agreed to the specific time - don't book without confirmation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string"},
                    "customer_email": {"type": "string"},
                    "customer_phone": {"type": "string", "description": "Optional"},
                    "reason": {"type": "string"},
                    "start_time": {"type": "string", "description": "ISO 8601 datetime, in IST (India Standard Time, no UTC offset), e.g. 2026-07-20T14:00:00"},
                    "end_time": {"type": "string", "description": "ISO 8601 datetime, in IST (India Standard Time, no UTC offset), e.g. 2026-07-20T14:30:00"},
                },
                "required": ["customer_name", "customer_email", "reason", "start_time", "end_time"],
            },
        },
    },
]


def build_customer_system_prompt() -> str:
    local_now = datetime.now(ZoneInfo(settings.CLINIC_TZ))
    return f"""You are the friendly booking assistant for {settings.BUSINESS_NAME}, talking directly to a customer in a chat widget.

The current date and time is: {local_now.strftime('%A, %Y-%m-%d %H:%M')} IST (India Standard Time).
Resolve relative dates ("tomorrow", "next Monday", "in an hour") against this IST time - never guess a year from training data.
All times you send to tools must be in IST wall-clock time (no UTC conversion, no offset) -
e.g. if the customer says "2pm", send 14:00:00 as-is. The backend handles converting IST to UTC for storage.

How to behave:
- Be warm and conversational, like a helpful front-desk person - not robotic, not overly formal. It's fine to open with a greeting if the customer greets you first.
- To book an appointment you need: their name, email, a short reason for the visit, and a specific start/end time. Ask for whatever's missing, one or two things at a time - don't interrogate them with a giant list up front.
- Before confirming any time, call check_availability. If it's taken, say so and ask them to pick another time - don't suggest random alternatives unless they ask you to.
- Only call book_appointment after the customer has explicitly agreed to a specific, available time. Never book without that confirmation.
- Never invent, assume, suggest, or default a date/time the customer didn't state themselves - not even as a suggestion, and not even by calling check_availability for it. Wait until the customer has actually told you a time before you check availability or mention any specific time back to them. If they haven't given you one yet, just ask what time works for them.
- If end_time isn't given, default the appointment to 30 minutes.
- Keep replies short - a few sentences at most.
- You are not a medical professional. Never diagnose, suggest medicine, or give medical/health advice of any kind, even if asked directly or the customer describes symptoms. If that comes up, gently redirect: explain you can only help book an appointment with a doctor, and offer to do that.
"""


async def run_customer_chat(messages: list[dict], execute_tool) -> tuple[str, Optional[dict]]:
    """
    Runs the tool-calling loop against Groq.

    `messages` is the running conversation as plain {role, content} dicts
    (already includes the new user message; the system prompt is added here).

    `execute_tool(name, arguments: dict) -> dict` is supplied by the caller
    (main.py) so this module never needs direct DB access - it just decides
    *what* to call and hands the actual booking/availability logic back out.

    Returns (final_reply_text, booking_dict_or_None). booking_dict is set
    only if book_appointment was actually called and returned a booking.
    """
    convo = [{"role": "system", "content": build_customer_system_prompt()}] + messages
    booking_result = None

    for _ in range(4):  # hard cap so a stuck loop can't run away
        try:
            response = await client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=convo,
                tools=CUSTOMER_TOOLS,
                tool_choice="auto",
                temperature=0.4,
            )
        except Exception as e:
            logger.error("Groq call failed: %s", e)
            return "Sorry, I'm having trouble connecting right now - please try again in a moment.", None

        msg = response.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None)

        if not tool_calls:
            return msg.content or "Sorry, could you say that again?", booking_result

        convo.append({"role": "assistant", "content": msg.content or "", "tool_calls": [
            {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
            for tc in tool_calls
        ]})

        for tc in tool_calls:
            try:
                args = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                args = {}

            try:
                result = await execute_tool(tc.function.name, args)
            except Exception as e:
                result = {"error": str(e)}

            if tc.function.name == "book_appointment" and "error" not in result:
                booking_result = result

            convo.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result),
            })

    return "Sorry, something went wrong on my end - could you try rephrasing that?", booking_result