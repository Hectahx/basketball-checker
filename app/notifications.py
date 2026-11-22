from __future__ import annotations

import requests

from .config import Settings
from .database import get_conn, iso_now
from .accounts import decrypt_text


class Notifier:
    def __init__(self, settings: Settings):
        self.settings = settings

    def notify(self, title: str, message: str) -> None:
        self._send_pushover(title, message)
        self._send_discord(title, message)

    def notify_for_user(self, user_id: int | None, title: str, message: str) -> None:
        # Global settings are the admin's audit channel and always receive it.
        self.notify(title, message)
        if user_id is None:
            return
        with get_conn(self.settings.database_path) as conn:
            row = conn.execute("SELECT encrypted_discord_webhook_url FROM user_notification_preferences WHERE user_id = ?", (user_id,)).fetchone()
        if row is None or not row["encrypted_discord_webhook_url"]:
            return
        try:
            webhook = decrypt_text(self.settings, row["encrypted_discord_webhook_url"])
            response = requests.post(webhook, json={"username": title, "embeds": [{"title": title, "description": message}]}, timeout=15)
            response.raise_for_status()
            self._record("discord-user", title, message, "success")
        except Exception as exc:
            self._record("discord-user", title, message, "failure", str(exc))

    def _record(self, channel: str, title: str, message: str, status: str, error: str | None = None) -> None:
        with get_conn(self.settings.database_path) as conn:
            conn.execute(
                """
                INSERT INTO notifications (created_at, channel, title, message, status, error)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (iso_now(), channel, title, message, status, error),
            )

    def _send_pushover(self, title: str, message: str) -> None:
        if not self.settings.pushover_api_token or not self.settings.pushover_user_key:
            return
        try:
            response = requests.post(
                "https://api.pushover.net/1/messages.json",
                data={
                    "token": self.settings.pushover_api_token,
                    "user": self.settings.pushover_user_key,
                    "title": title,
                    "message": message,
                },
                timeout=15,
            )
            response.raise_for_status()
            self._record("pushover", title, message, "success")
        except Exception as exc:
            self._record("pushover", title, message, "failure", str(exc))

    def _send_discord(self, title: str, message: str) -> None:
        if not self.settings.discord_webhook_url:
            return
        try:
            response = requests.post(
                self.settings.discord_webhook_url,
                json={
                    "content": self.settings.discord_mention,
                    "username": title,
                    "embeds": [{"title": title, "description": message}],
                },
                timeout=15,
            )
            response.raise_for_status()
            self._record("discord", title, message, "success")
        except Exception as exc:
            self._record("discord", title, message, "failure", str(exc))
