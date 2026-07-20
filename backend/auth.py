"""
JWT authentication - kept intentionally simple:
- passwords hashed with bcrypt (called directly, see note below)
- one access token per login, no refresh tokens
- one role check (admin) - easy to extend later if you add more roles
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_session
from models import User

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Password helpers
#
# Using the `bcrypt` library directly rather than passlib's CryptContext:
# passlib 1.7.4's backend-detection code crashes on bcrypt>=4.1 (it reaches
# for an internal attribute bcrypt removed), which breaks signup out of the
# box on a fresh install. Calling bcrypt directly sidesteps that entirely.
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes of the input; anything beyond
    # that is silently ignored by design, same as passlib's behaviour.
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8")[:72], hashed_password.encode("utf-8"))
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def create_access_token(user_id: str, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Requires a valid JWT bearer token. Raises 401 if missing/invalid."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def require_admin_jwt_or_key(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_admin_key: Optional[str] = Header(default=None),
):
    """
    Flexible admin check - passes if EITHER is true:
      - a valid JWT for a user with role 'admin' is provided, OR
      - the legacy X-Admin-Key header matches settings.ADMIN_KEY

    This keeps your existing admin-key workflow working while adding
    real login on top of it.
    """
    # Try the legacy static key first (fast path, no DB lookup needed)
    if x_admin_key is not None and x_admin_key == settings.ADMIN_KEY:
        return True

    # Otherwise require a valid admin JWT
    if credentials is None:
        raise HTTPException(status_code=401, detail="Invalid admin key or missing token")

    payload = decode_access_token(credentials.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    return True
