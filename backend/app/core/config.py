import secrets
import warnings

from pydantic import model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


_INSECURE_DEFAULTS = {"change-me-in-production", "", "dev-only-change-in-production"}


class Settings(BaseSettings):
    app_name: str = "LeanPilot"
    app_version: str = "1.0.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://leanpilot:leanpilot@localhost:5432/leanpilot"

    # Auth
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15  # Short-lived access tokens (GDPR best practice)
    refresh_token_expire_days: int = 7
    password_min_length: int = 12

    # Rate limiting
    rate_limit_login_per_minute: int = 5
    rate_limit_api_per_minute: int = 60
    account_lockout_attempts: int = 5
    account_lockout_minutes: int = 15

    # AI Module
    ai_module_enabled: bool = True
    openai_api_key: str = ""
    ai_model: str = "gpt-4o"

    # Email (SMTP) — leave smtp_host empty for dev console logging
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@autopilot.rs"

    # App URL (for email links)
    app_url: str = "https://lean.autopilot.rs"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # CORS (comma-separated origins for production)
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # Data retention (days) — GDPR Art. 5(1)(e) storage limitation
    retention_ai_conversations_days: int = 90
    retention_production_data_days: int = 1825  # 5 years
    retention_audit_log_days: int = 365
    retention_deleted_account_grace_days: int = 30

    # Privacy
    anonymize_ai_data: bool = True  # Strip employee IDs before sending to OpenAI

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        if self.secret_key in _INSECURE_DEFAULTS:
            if self.debug:
                self.secret_key = secrets.token_urlsafe(64)
                warnings.warn(
                    "SECRET_KEY not set — using random ephemeral key. "
                    "Set SECRET_KEY in .env for production!",
                    stacklevel=2,
                )
            else:
                raise ValueError(
                    "FATAL: SECRET_KEY is not configured. "
                    "Set a strong SECRET_KEY in your .env file before running in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
        return self

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
