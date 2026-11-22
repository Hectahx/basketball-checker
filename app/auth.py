from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings
from .database import get_conn, iso_now


security = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: int
    username: str
    role: str

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, salt_encoded, digest_encoded = encoded.split("$", 2)
        if algorithm != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode("utf-8"), salt=_b64decode(salt_encoded), n=2**14, r=8, p=1)
        return hmac.compare_digest(digest, _b64decode(digest_encoded))
    except Exception:
        return False


def ensure_initial_admin(settings: Settings) -> None:
    """Create the one bootstrap admin on a new database; never overwrite it."""
    with get_conn(settings.database_path) as conn:
        existing = conn.execute("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").fetchone()
        if existing is None:
            conn.execute(
                "INSERT INTO users (username, password_hash, role, enabled, created_at) VALUES (?, ?, 'admin', 1, ?)",
                ("admin", hash_password(settings.app_password), iso_now()),
            )


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_token(settings: Settings, user: CurrentUser, lifetime: timedelta = timedelta(hours=12)) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + lifetime
    payload = {"sub": str(user.id), "username": user.username, "role": user.role, "exp": int(expires_at.timestamp())}
    payload_raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_encoded = _b64encode(payload_raw)
    signature = hmac.new(settings.app_secret.encode("utf-8"), payload_encoded.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_encoded}.{_b64encode(signature)}", expires_at


def verify_token(token: str, settings: Settings) -> dict:
    try:
        payload_encoded, signature_encoded = token.split(".", 1)
        expected = hmac.new(
            settings.app_secret.encode("utf-8"),
            payload_encoded.encode("ascii"),
            hashlib.sha256,
        ).digest()
        supplied = _b64decode(signature_encoded)
        if not hmac.compare_digest(expected, supplied):
            raise ValueError("Bad signature")
        payload = json.loads(_b64decode(payload_encoded))
        if int(payload["exp"]) < int(datetime.now(UTC).timestamp()):
            raise ValueError("Expired token")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = verify_token(credentials.credentials, settings)
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc
    with get_conn(settings.database_path) as conn:
        row = conn.execute("SELECT id, username, role, enabled FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None or not row["enabled"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is disabled or no longer exists")
    return CurrentUser(id=row["id"], username=row["username"], role=row["role"])
