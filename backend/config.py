from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    # Your business info (shown in emails)
    BUSINESS_NAME: str = "My Clinic"

    # Simple admin password to protect accept/reject actions (still works
    # alongside JWT - either one gets you past the admin check)
    ADMIN_KEY: str = "changeme123"

    # Comma-separated list of origins allowed to call this API from the
    # browser, e.g. "https://your-app.vercel.app,http://localhost:5173"
    CORS_ORIGINS: Union[str, List[str]] = "*"

    @field_validator("CORS_ORIGINS")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database (SQLite file - no separate database server needed)
    DATABASE_URL: str = "sqlite+aiosqlite:///./bookings.db"

    # The clinic operates in this timezone. All customer-facing "what time is
    # it / what time do you mean" logic is anchored to this - hardcoded rather
    # than trusting the browser, since Meridian Clinic only operates in IST.
    CLINIC_TZ: str = "Asia/Kolkata"

    # Email (Gmail example - use an "App Password", not your real password)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "your-email@gmail.com"
    SMTP_PASSWORD: str = "your-app-password"

    # JWT auth
    JWT_SECRET_KEY: str = "change-this-to-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Groq AI agent
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    class Config:
        env_file = ".env"


settings = Settings()
