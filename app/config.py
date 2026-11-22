from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    sport_aston_user: str | None
    sport_aston_password: str | None
    pushover_api_token: str | None
    pushover_user_key: str | None
    discord_webhook_url: str | None
    discord_mention: str | None
    app_password: str
    app_secret: str
    database_path: Path
    timezone: str
    scheduler_enabled: bool
    credential_encryption_key: str | None = None
    public_app_url: str = "http://localhost:5173"


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_settings() -> Settings:
    app_password = os.getenv("APP_PASSWORD", "admin")
    return Settings(
        sport_aston_user=os.getenv("user") or os.getenv("SPORT_ASTON_USER"),
        sport_aston_password=os.getenv("pw") or os.getenv("SPORT_ASTON_PASSWORD"),
        pushover_api_token=os.getenv("pushover_api_token") or os.getenv("PUSHOVER_API_TOKEN"),
        pushover_user_key=os.getenv("pushover_user_key") or os.getenv("PUSHOVER_USER_KEY"),
        discord_webhook_url=os.getenv("discord_webhook_url") or os.getenv("DISCORD_WEBHOOK_URL"),
        discord_mention=os.getenv("DISCORD_MENTION", "<@1043508862604554331>"),
        app_password=app_password,
        app_secret=os.getenv("APP_SECRET", app_password),
        credential_encryption_key=os.getenv("CREDENTIAL_ENCRYPTION_KEY"),
        database_path=Path(os.getenv("BOOKER_DB_PATH", "booker.sqlite3")),
        timezone=os.getenv("BOOKER_TIMEZONE", "Europe/London"),
        scheduler_enabled=_bool_env("SCHEDULER_ENABLED", True),
        public_app_url=os.getenv("PUBLIC_APP_URL", "http://localhost:5173").rstrip("/"),
    )
