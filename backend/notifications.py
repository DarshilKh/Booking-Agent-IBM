import logging
from email.message import EmailMessage

import aiosmtplib

from config import settings
from models import Booking

logger = logging.getLogger(__name__)


async def send_email(to_email: str, subject: str, body: str):
    message = EmailMessage()
    message["From"] = settings.SMTP_USER
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            start_tls=True,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
        )
        logger.info(f"Email sent to {to_email}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")


def _when(dt) -> str:
    return dt.strftime("%A, %d %B %Y at %I:%M %p")


async def notify_booking_created(booking: Booking):
    await send_email(
        booking.customer_email,
        f"Booking Received - {settings.BUSINESS_NAME}",
        f"Hi {booking.customer_name},\n\n"
        f"We received your booking request.\n\n"
        f"Reason: {booking.reason}\n"
        f"Requested time: {_when(booking.start_time)}\n\n"
        f"We'll confirm shortly.\n\n{settings.BUSINESS_NAME}",
    )


async def notify_booking_accepted(booking: Booking):
    await send_email(
        booking.customer_email,
        f"Booking Confirmed - {settings.BUSINESS_NAME}",
        f"Hi {booking.customer_name},\n\n"
        f"Your booking is CONFIRMED.\n\n"
        f"Reason: {booking.reason}\n"
        f"Time: {_when(booking.start_time)}\n\n"
        f"See you then!\n\n{settings.BUSINESS_NAME}",
    )


async def notify_booking_rejected(booking: Booking):
    await send_email(
        booking.customer_email,
        f"Booking Not Available - {settings.BUSINESS_NAME}",
        f"Hi {booking.customer_name},\n\n"
        f"Unfortunately we couldn't confirm your booking for:\n\n"
        f"Reason: {booking.reason}\n"
        f"Requested time: {_when(booking.start_time)}\n\n"
        f"Please try a different time slot.\n\n{settings.BUSINESS_NAME}",
    )
