from __future__ import annotations

import base64
import hashlib
import sqlite3
import uuid
from datetime import timedelta

from cryptography.fernet import Fernet

from .config import Settings
from .database import get_conn, iso_now, row_to_dict
from .database import utc_now


def _cipher(settings: Settings) -> Fernet:
    # A dedicated CREDENTIAL_ENCRYPTION_KEY is preferred. Deriving a stable key
    # from APP_SECRET keeps existing installations usable, but APP_SECRET must
    # be changed from its development default before storing private credentials.
    key = settings.credential_encryption_key
    if not key:
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.app_secret.encode("utf-8")).digest()).decode("ascii")
    return Fernet(key.encode("ascii"))


def encrypt_text(settings: Settings, value: str) -> str:
    return _cipher(settings).encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_text(settings: Settings, value: str) -> str:
    return _cipher(settings).decrypt(value.encode("ascii")).decode("utf-8")


class AstonAccountStore:
    def __init__(self, settings: Settings):
        self.settings = settings

    def ensure_shared_account(self, admin_user_id: int) -> int:
        with get_conn(self.settings.database_path) as conn:
            row = conn.execute("SELECT id FROM aston_accounts WHERE credential_mode = 'environment' LIMIT 1").fetchone()
            if row is None:
                cursor = conn.execute(
                    "INSERT INTO aston_accounts (label, credential_mode, created_by_user_id, created_at) VALUES (?, 'environment', ?, ?)",
                    ("Admin shared Aston account", admin_user_id, iso_now()),
                )
                account_id = int(cursor.lastrowid)
            else:
                account_id = int(row["id"])
            conn.execute("INSERT OR IGNORE INTO aston_account_members (aston_account_id, user_id) VALUES (?, ?)", (account_id, admin_user_id))
        return account_id

    def list_for_user(self, user_id: int, is_admin: bool = False) -> list[dict]:
        with get_conn(self.settings.database_path) as conn:
            if is_admin:
                rows = conn.execute("SELECT * FROM aston_accounts ORDER BY id").fetchall()
            else:
                rows = conn.execute(
                    "SELECT a.* FROM aston_accounts a JOIN aston_account_members m ON m.aston_account_id = a.id WHERE m.user_id = ? ORDER BY a.id",
                    (user_id,),
                ).fetchall()
        return [row_to_dict(row) for row in rows]

    def can_use(self, account_id: int, user_id: int, is_admin: bool = False) -> bool:
        if is_admin:
            return True
        with get_conn(self.settings.database_path) as conn:
            return conn.execute(
                "SELECT 1 FROM aston_account_members WHERE aston_account_id = ? AND user_id = ?", (account_id, user_id)
            ).fetchone() is not None

    def credentials(self, account_id: int) -> tuple[str | None, str | None]:
        with get_conn(self.settings.database_path) as conn:
            row = conn.execute("SELECT * FROM aston_accounts WHERE id = ?", (account_id,)).fetchone()
        if row is None:
            raise ValueError("Aston account not found")
        if row["credential_mode"] == "environment":
            return self.settings.sport_aston_user, self.settings.sport_aston_password
        cipher = _cipher(self.settings)
        return (
            cipher.decrypt(row["encrypted_username"].encode("ascii")).decode("utf-8"),
            cipher.decrypt(row["encrypted_password"].encode("ascii")).decode("utf-8"),
        )

    def grant(self, account_id: int, user_id: int) -> None:
        with get_conn(self.settings.database_path) as conn:
            conn.execute("INSERT OR IGNORE INTO aston_account_members (aston_account_id, user_id) VALUES (?, ?)", (account_id, user_id))

    def shared_account(self) -> dict | None:
        with get_conn(self.settings.database_path) as conn:
            row = conn.execute("SELECT * FROM aston_accounts WHERE credential_mode = 'environment' ORDER BY id LIMIT 1").fetchone()
        return row_to_dict(row) if row else None

    def create_private(self, label: str, username: str, password: str, owner_user_id: int, conn: sqlite3.Connection | None = None) -> dict:
        """Store an encrypted private account. Pass ``conn`` to join a caller's transaction."""
        if conn is None:
            with get_conn(self.settings.database_path) as own_conn:
                return self.create_private(label, username, password, owner_user_id, conn=own_conn)
        cipher = _cipher(self.settings)
        cursor = conn.execute(
            "INSERT INTO aston_accounts (label, credential_mode, encrypted_username, encrypted_password, created_by_user_id, created_at) VALUES (?, 'stored', ?, ?, ?, ?)",
            (label, cipher.encrypt(username.encode("utf-8")).decode("ascii"), cipher.encrypt(password.encode("utf-8")).decode("ascii"), owner_user_id, iso_now()),
        )
        account_id = int(cursor.lastrowid)
        conn.execute("INSERT INTO aston_account_members (aston_account_id, user_id) VALUES (?, ?)", (account_id, owner_user_id))
        row = conn.execute("SELECT * FROM aston_accounts WHERE id = ?", (account_id,)).fetchone()
        return row_to_dict(row)


class SlotReservationStore:
    """A SQLite-backed mutex shared by manual and scheduled bookings."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def reserve(self, account_id: int, slot_identities: list[str], user_id: int) -> str | None:
        request_id = str(uuid.uuid4())
        expires_at = (utc_now() + timedelta(minutes=2)).isoformat()
        with get_conn(self.settings.database_path) as conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("DELETE FROM slot_reservations WHERE status = 'reserved' AND expires_at <= ?", (iso_now(),))
            for identity in slot_identities:
                try:
                    conn.execute(
                        "INSERT INTO slot_reservations (aston_account_id, slot_identity, booking_request_id, user_id, expires_at, status, created_at) VALUES (?, ?, ?, ?, ?, 'reserved', ?)",
                        (account_id, identity, request_id, user_id, expires_at, iso_now()),
                    )
                except Exception:
                    conn.execute("DELETE FROM slot_reservations WHERE booking_request_id = ?", (request_id,))
                    return None
        return request_id

    def finish(self, request_id: str, success: bool) -> None:
        with get_conn(self.settings.database_path) as conn:
            if success:
                conn.execute("UPDATE slot_reservations SET status = 'booked', expires_at = ? WHERE booking_request_id = ?", (iso_now(), request_id))
            else:
                conn.execute("DELETE FROM slot_reservations WHERE booking_request_id = ?", (request_id,))
