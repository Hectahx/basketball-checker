from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator


SCHEMA = """
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sport TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    activity_ids TEXT NOT NULL DEFAULT '[]',
    days_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    lookahead_days INTEGER NOT NULL,
    run_interval_minutes INTEGER NOT NULL DEFAULT 5,
    max_price_pence INTEGER,
    notify_on_success INTEGER NOT NULL DEFAULT 1,
    notify_on_failure INTEGER NOT NULL DEFAULT 1,
    notify_on_availability INTEGER NOT NULL DEFAULT 0,
    last_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aston_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    credential_mode TEXT NOT NULL CHECK(credential_mode IN ('environment', 'stored')),
    encrypted_username TEXT,
    encrypted_password TEXT,
    created_by_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(label)
);

CREATE TABLE IF NOT EXISTS aston_account_members (
    aston_account_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (aston_account_id, user_id),
    FOREIGN KEY(aston_account_id) REFERENCES aston_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS slot_reservations (
    aston_account_id INTEGER NOT NULL,
    slot_identity TEXT NOT NULL,
    booking_request_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('reserved', 'booked', 'released')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (aston_account_id, slot_identity),
    FOREIGN KEY(aston_account_id) REFERENCES aston_accounts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id INTEGER PRIMARY KEY,
    encrypted_discord_webhook_url TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    shared_access INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_by_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS booking_holds (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    aston_account_id INTEGER,
    rule_id INTEGER,
    start_time_local TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    slot_identities TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'held',
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(aston_account_id) REFERENCES aston_accounts(id),
    FOREIGN KEY(rule_id) REFERENCES rules(id)
);

CREATE TABLE IF NOT EXISTS availability_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    sport TEXT NOT NULL,
    rule_id INTEGER,
    status TEXT NOT NULL,
    slot_count INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    FOREIGN KEY(rule_id) REFERENCES rules(id)
);

CREATE TABLE IF NOT EXISTS booking_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    sport TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    activity_name TEXT NOT NULL,
    bookable_item_id TEXT NOT NULL,
    bookable_item_name TEXT NOT NULL,
    start_time_utc INTEGER NOT NULL,
    start_time_local TEXT NOT NULL,
    price TEXT,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    rule_id INTEGER,
    response_type TEXT,
    response_json TEXT,
    error TEXT,
    slot_identity TEXT NOT NULL,
    FOREIGN KEY(rule_id) REFERENCES rules(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_attempts_slot_identity
    ON booking_attempts(slot_identity);

CREATE INDEX IF NOT EXISTS idx_booking_attempts_created_at
    ON booking_attempts(created_at);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    channel TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT
);
"""


def utc_now() -> datetime:
    return datetime.now(UTC)


def iso_now() -> str:
    return utc_now().isoformat()


def connect(database_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with connect(database_path) as conn:
        conn.executescript(SCHEMA)
        # These columns were added after the first web-app release. SQLite does
        # not support ADD COLUMN IF NOT EXISTS, so make upgrades idempotent here.
        for table in ("rules", "availability_checks", "booking_attempts"):
            columns = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
            if "user_id" not in columns:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER")
        rule_columns = {row[1] for row in conn.execute("PRAGMA table_info(rules)")}
        for name, definition in (
            ("aston_account_id", "INTEGER"),
            ("duration_minutes", "INTEGER NOT NULL DEFAULT 60"),
            ("preferred_start_time", "TEXT"),
            ("allow_fallback", "INTEGER NOT NULL DEFAULT 0"),
        ):
            if name not in rule_columns:
                conn.execute(f"ALTER TABLE rules ADD COLUMN {name} {definition}")


@contextmanager
def get_conn(database_path: Path) -> Iterator[sqlite3.Connection]:
    conn = connect(database_path)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def encode_json(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"))


def decode_json(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)
