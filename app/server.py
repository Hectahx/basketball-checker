from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import secrets

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .auth import CurrentUser, create_token, ensure_initial_admin, hash_password, require_auth, verify_password
from .accounts import AstonAccountStore, encrypt_text
from .config import Settings, get_settings
from .database import get_conn, init_db, iso_now, row_to_dict
from .models import (
    AvailabilityResponse,
    AstonAccountCreate,
    AstonAccountOut,
    BookingAttemptOut,
    BookingRequest,
    HistoryResponse,
    HoldOut,
    InviteAccept,
    InviteCreate,
    InviteOut,
    LoginRequest,
    LoginResponse,
    NotificationPreferences,
    RuleCreate,
    RuleOut,
    RuleRunResponse,
    RuleUpdate,
    SportOut,
    UserCreate,
    UserUpdate,
    UserOut,
)
from .rules import BookingService, RuleRunner, RuleStore, _row_to_attempt
from .sport_aston import SportAstonClient, slot_from_booking_request
from .sports import SPORTS


def create_app() -> FastAPI:
    settings = get_settings()
    init_db(settings.database_path)
    ensure_initial_admin(settings)
    with get_conn(settings.database_path) as conn:
        admin_row = conn.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").fetchone()
    if admin_row is not None:
        AstonAccountStore(settings).ensure_shared_account(int(admin_row["id"]))

    app = FastAPI(title="Basketball Booker", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    scheduler: BackgroundScheduler | None = None
    if settings.scheduler_enabled:
        scheduler = BackgroundScheduler(timezone=settings.timezone)
        scheduler.add_job(lambda: RuleRunner(get_settings()).run_due_rules(), "interval", minutes=1, id="rule-runner")
        scheduler.start()

    @app.on_event("shutdown")
    def shutdown_scheduler() -> None:
        if scheduler:
            scheduler.shutdown(wait=False)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/auth/login", response_model=LoginResponse)
    def login(payload: LoginRequest, settings: Settings = Depends(get_settings)) -> LoginResponse:
        with get_conn(settings.database_path) as conn:
            row = conn.execute("SELECT id, username, password_hash, role, enabled FROM users WHERE username = ?", (payload.username,)).fetchone()
        if row is None or not row["enabled"] or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid password")
        user = CurrentUser(id=row["id"], username=row["username"], role=row["role"])
        token, expires_at = create_token(settings, user)
        return LoginResponse(token=token, expires_at=expires_at)

    @app.get("/api/auth/me")
    def me(current_user: CurrentUser = Depends(require_auth)) -> dict[str, str | int]:
        return {"id": current_user.id, "username": current_user.username, "role": current_user.role}

    @app.get("/api/users", response_model=list[UserOut])
    def list_users(current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> list[UserOut]:
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        with get_conn(settings.database_path) as conn:
            rows = conn.execute(
                """
                SELECT u.id, u.username, u.role, u.enabled, u.created_at,
                       EXISTS(
                           SELECT 1 FROM aston_account_members m
                           JOIN aston_accounts a ON a.id = m.aston_account_id
                           WHERE m.user_id = u.id AND a.credential_mode = 'environment'
                       ) AS shared_access
                FROM users u ORDER BY u.id
                """
            ).fetchall()
        return [UserOut(**{**row_to_dict(row), "enabled": bool(row["enabled"]), "shared_access": bool(row["shared_access"])}) for row in rows]

    @app.post("/api/users", response_model=UserOut, status_code=201)
    def create_user(payload: UserCreate, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> UserOut:
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        with get_conn(settings.database_path) as conn:
            try:
                cursor = conn.execute(
                    "INSERT INTO users (username, password_hash, role, enabled, created_at) VALUES (?, ?, ?, 1, ?)",
                    (payload.username, hash_password(payload.password), payload.role, iso_now()),
                )
            except Exception as exc:
                if "UNIQUE" in str(exc).upper():
                    raise HTTPException(status_code=409, detail="That username is already in use") from exc
                raise
            row = conn.execute("SELECT id, username, role, enabled, created_at FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
            shared = conn.execute("SELECT id FROM aston_accounts WHERE credential_mode = 'environment' LIMIT 1").fetchone()
            if payload.shared_access and shared is not None:
                conn.execute("INSERT OR IGNORE INTO aston_account_members (aston_account_id, user_id) VALUES (?, ?)", (shared["id"], cursor.lastrowid))
        return UserOut(**{**row_to_dict(row), "enabled": bool(row["enabled"])})

    @app.patch("/api/users/{user_id}", response_model=UserOut)
    def update_user(user_id: int, payload: UserUpdate, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> UserOut:
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        with get_conn(settings.database_path) as conn:
            user = conn.execute("SELECT id, role FROM users WHERE id = ?", (user_id,)).fetchone()
            if user is None:
                raise HTTPException(status_code=404, detail="User not found")
            bootstrap_admin = conn.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").fetchone()
            if payload.role is not None and bootstrap_admin is not None and user_id == bootstrap_admin["id"] and payload.role != "admin":
                raise HTTPException(status_code=400, detail="The main admin account cannot be demoted")
            if payload.enabled is not None:
                conn.execute("UPDATE users SET enabled = ? WHERE id = ?", (int(payload.enabled), user_id))
            if payload.role is not None:
                conn.execute("UPDATE users SET role = ? WHERE id = ?", (payload.role, user_id))
            row = conn.execute("SELECT id, username, role, enabled, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
        return UserOut(**{**row_to_dict(row), "enabled": bool(row["enabled"])})

    @app.post("/api/invites", response_model=InviteOut, status_code=201)
    def create_invite(payload: InviteCreate, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> InviteOut:
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(days=7)
        with get_conn(settings.database_path) as conn:
            cursor = conn.execute("INSERT INTO invitations (token_hash, shared_access, expires_at, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?)", (hashlib.sha256(token.encode("utf-8")).hexdigest(), int(payload.shared_access), expires_at.isoformat(), current_user.id, iso_now()))
        return InviteOut(id=int(cursor.lastrowid), invite_url=f"{settings.public_app_url}/?invite={token}", shared_access=payload.shared_access, expires_at=expires_at)

    @app.post("/api/invites/accept", response_model=LoginResponse)
    def accept_invite(payload: InviteAccept, settings: Settings = Depends(get_settings)) -> LoginResponse:
        with get_conn(settings.database_path) as conn:
            invite = conn.execute("SELECT * FROM invitations WHERE token_hash = ?", (hashlib.sha256(payload.token.encode("utf-8")).hexdigest(),)).fetchone()
            if invite is None or invite["accepted_at"] is not None or datetime.fromisoformat(invite["expires_at"]) <= datetime.now(UTC):
                raise HTTPException(status_code=400, detail="This invite is invalid or expired")
            if payload.use_shared_account and not invite["shared_access"]:
                raise HTTPException(status_code=400, detail="This invite does not include shared Aston access")
            if not payload.use_shared_account and (not payload.aston_username or not payload.aston_password):
                raise HTTPException(status_code=400, detail="Private Aston credentials are required")
            try:
                cursor = conn.execute("INSERT INTO users (username, password_hash, role, enabled, created_at) VALUES (?, ?, 'user', 1, ?)", (payload.username, hash_password(payload.password), iso_now()))
            except Exception as exc:
                raise HTTPException(status_code=409, detail="That username is already in use") from exc
            user_id = int(cursor.lastrowid)
            conn.execute("UPDATE invitations SET accepted_at = ? WHERE id = ?", (iso_now(), invite["id"]))
        accounts = AstonAccountStore(settings)
        if payload.use_shared_account:
            shared = next(account for account in accounts.list_for_user(0, True) if account["credential_mode"] == "environment")
            accounts.grant(shared["id"], user_id)
        if payload.aston_username and payload.aston_password:
            accounts.create_private(payload.private_account_label or "My Aston account", payload.aston_username, payload.aston_password, user_id)
        token, expires_at = create_token(settings, CurrentUser(id=user_id, username=payload.username, role="user"))
        return LoginResponse(token=token, expires_at=expires_at)

    @app.get("/api/aston-accounts", response_model=list[AstonAccountOut])
    def list_aston_accounts(current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> list[AstonAccountOut]:
        return [AstonAccountOut(**row) for row in AstonAccountStore(settings).list_for_user(current_user.id, current_user.is_admin)]

    @app.post("/api/aston-accounts", response_model=AstonAccountOut, status_code=201)
    def create_aston_account(payload: AstonAccountCreate, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> AstonAccountOut:
        # A member may add their own private Aston account; admins may create one
        # then grant it to an invited user below.
        owner_id = payload.member_user_id if current_user.is_admin and payload.member_user_id is not None else current_user.id
        created = AstonAccountStore(settings).create_private(payload.label, payload.username, payload.password, owner_id)
        return AstonAccountOut(**created)

    @app.post("/api/aston-accounts/{account_id}/members/{user_id}")
    def grant_aston_account(account_id: int, user_id: int, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> dict[str, str]:
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        AstonAccountStore(settings).grant(account_id, user_id)
        return {"status": "granted"}

    @app.delete("/api/aston-accounts/{account_id}/members/{user_id}")
    def revoke_aston_account(account_id: int, user_id: int, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> dict[str, str]:
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        with get_conn(settings.database_path) as conn:
            conn.execute("DELETE FROM aston_account_members WHERE aston_account_id = ? AND user_id = ?", (account_id, user_id))
        return {"status": "revoked"}

    @app.get("/api/notification-preferences", response_model=NotificationPreferences)
    def notification_preferences(current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> NotificationPreferences:
        with get_conn(settings.database_path) as conn:
            row = conn.execute("SELECT encrypted_discord_webhook_url FROM user_notification_preferences WHERE user_id = ?", (current_user.id,)).fetchone()
        # Never return a stored webhook secret to the browser.
        return NotificationPreferences(discord_webhook_url="configured" if row and row["encrypted_discord_webhook_url"] else None)

    @app.put("/api/notification-preferences", response_model=NotificationPreferences)
    def set_notification_preferences(payload: NotificationPreferences, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> NotificationPreferences:
        encrypted = encrypt_text(settings, payload.discord_webhook_url) if payload.discord_webhook_url else None
        with get_conn(settings.database_path) as conn:
            conn.execute("INSERT INTO user_notification_preferences (user_id, encrypted_discord_webhook_url) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET encrypted_discord_webhook_url = excluded.encrypted_discord_webhook_url", (current_user.id, encrypted))
        return NotificationPreferences(discord_webhook_url="configured" if encrypted else None)

    @app.get("/api/sports", response_model=list[SportOut], dependencies=[Depends(require_auth)])
    def sports() -> list[SportOut]:
        return [
            SportOut(
                id=sport.id,
                label=sport.label,
                activities=[{"id": activity.id, "name": activity.name} for activity in sport.activities],
            )
            for sport in SPORTS.values()
        ]

    @app.get("/api/availability", response_model=AvailabilityResponse)
    def availability(
        sport: str = "basketball",
        lookahead_days: int = 10,
        current_user: CurrentUser = Depends(require_auth),
        settings: Settings = Depends(get_settings),
    ) -> AvailabilityResponse:
        client = SportAstonClient(settings)
        slots = client.get_availability(sport, lookahead_days)
        with get_conn(settings.database_path) as conn:
            conn.execute(
                """
                INSERT INTO availability_checks (created_at, sport, rule_id, status, slot_count, matched_count, error, user_id)
                VALUES (?, ?, NULL, ?, ?, ?, NULL, ?)
                """,
                (iso_now(), sport, "success", len(slots), len([slot for slot in slots if slot.available]), current_user.id),
            )
        return AvailabilityResponse(sport=sport, checked_at=datetime.fromisoformat(iso_now()), slots=slots)

    @app.post("/api/bookings", response_model=BookingAttemptOut)
    def book(payload: BookingRequest, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> BookingAttemptOut:
        slot = slot_from_booking_request(settings, payload)
        accounts = AstonAccountStore(settings).list_for_user(current_user.id, current_user.is_admin)
        account_id = payload.aston_account_id or (accounts[0]["id"] if accounts else None)
        if account_id is None or not AstonAccountStore(settings).can_use(account_id, current_user.id, current_user.is_admin):
            raise HTTPException(status_code=403, detail="You cannot use that Aston account")
        client = SportAstonClient(settings, AstonAccountStore(settings).credentials(account_id))
        return BookingService(settings, client, user_id=current_user.id, aston_account_id=account_id).book(slot, source="manual")

    @app.get("/api/rules", response_model=list[RuleOut])
    def list_rules(current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> list[RuleOut]:
        return RuleStore(settings, current_user.id, current_user.is_admin).list_rules()

    @app.post("/api/rules", response_model=RuleOut)
    def create_rule(payload: RuleCreate, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> RuleOut:
        accounts = AstonAccountStore(settings).list_for_user(current_user.id, current_user.is_admin)
        if payload.aston_account_id is None:
            if not accounts:
                raise HTTPException(status_code=400, detail="No Aston account is available for this user")
            payload = payload.model_copy(update={"aston_account_id": accounts[0]["id"]})
        if not AstonAccountStore(settings).can_use(payload.aston_account_id, current_user.id, current_user.is_admin):
            raise HTTPException(status_code=403, detail="You cannot use that Aston account")
        return RuleStore(settings, current_user.id, current_user.is_admin).create_rule(payload)

    @app.patch("/api/rules/{rule_id}", response_model=RuleOut)
    def update_rule(rule_id: int, payload: RuleUpdate, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> RuleOut:
        try:
            if payload.aston_account_id is not None and not AstonAccountStore(settings).can_use(payload.aston_account_id, current_user.id, current_user.is_admin):
                raise HTTPException(status_code=403, detail="You cannot use that Aston account")
            return RuleStore(settings, current_user.id, current_user.is_admin).update_rule(rule_id, payload)
        except KeyError:
            raise HTTPException(status_code=404, detail="Rule not found")

    @app.delete("/api/rules/{rule_id}")
    def delete_rule(rule_id: int, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> dict[str, str]:
        RuleStore(settings, current_user.id, current_user.is_admin).delete_rule(rule_id)
        return {"status": "deleted"}

    @app.post("/api/rules/{rule_id}/run", response_model=RuleRunResponse)
    def run_rule(rule_id: int, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> RuleRunResponse:
        try:
            return RuleRunner(settings, user_id=current_user.id, is_admin=current_user.is_admin).run_fair_for_rule(rule_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Rule not found")

    @app.get("/api/history", response_model=HistoryResponse)
    def history(limit: int = 100, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> HistoryResponse:
        limit = max(1, min(limit, 500))
        with get_conn(settings.database_path) as conn:
            clause, params = ("", ()) if current_user.is_admin else (" WHERE user_id = ?", (current_user.id,))
            attempts = conn.execute(f"SELECT * FROM booking_attempts{clause} ORDER BY id DESC LIMIT ?", (*params, limit)).fetchall()
            checks = conn.execute(f"SELECT * FROM availability_checks{clause} ORDER BY id DESC LIMIT ?", (*params, limit)).fetchall()
        return HistoryResponse(
            booking_attempts=[_row_to_attempt(row) for row in attempts],
            availability_checks=[row_to_dict(row) for row in checks],
        )

    @app.get("/api/holds", response_model=list[HoldOut])
    def holds(limit: int = 100, current_user: CurrentUser = Depends(require_auth), settings: Settings = Depends(get_settings)) -> list[HoldOut]:
        limit = max(1, min(limit, 500))
        with get_conn(settings.database_path) as conn:
            clause, params = ("", ()) if current_user.is_admin else (" WHERE user_id = ?", (current_user.id,))
            rows = conn.execute(f"SELECT id, user_id, aston_account_id, rule_id, start_time_local, duration_minutes, status, created_at FROM booking_holds{clause} ORDER BY created_at DESC LIMIT ?", (*params, limit)).fetchall()
        return [HoldOut(**row_to_dict(row)) for row in rows]

    return app


app = create_app()
