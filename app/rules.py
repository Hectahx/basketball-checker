from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from typing import Any

from .config import Settings
from .accounts import AstonAccountStore, SlotReservationStore
from .database import decode_json, encode_json, get_conn, iso_now, row_to_dict, utc_now
from .models import BookingAttemptOut, RuleCreate, RuleOut, RuleRunResponse, RuleUpdate, Slot
from .notifications import Notifier
from .sport_aston import SportAstonClient


def _parse_minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def _row_to_rule(row) -> RuleOut:
    data = row_to_dict(row)
    data["enabled"] = bool(data["enabled"])
    data["activity_ids"] = decode_json(data["activity_ids"], [])
    data["days_of_week"] = decode_json(data["days_of_week"], [])
    data["notify_on_success"] = bool(data["notify_on_success"])
    data["notify_on_failure"] = bool(data["notify_on_failure"])
    data["notify_on_availability"] = bool(data["notify_on_availability"])
    data["allow_fallback"] = bool(data["allow_fallback"])
    return RuleOut(**data)


def _row_to_attempt(row) -> BookingAttemptOut:
    data = row_to_dict(row)
    return BookingAttemptOut(**data)


def filter_slots(rule: RuleOut, slots: list[Slot]) -> list[Slot]:
    start = _parse_minutes(rule.start_time)
    end = _parse_minutes(rule.end_time)
    activity_ids = set(rule.activity_ids)
    matched: list[Slot] = []
    for slot in slots:
        if not slot.available:
            continue
        if slot.sport != rule.sport:
            continue
        if activity_ids and slot.activity_id not in activity_ids:
            continue
        if slot.start_time_local.weekday() not in rule.days_of_week:
            continue
        slot_minutes = slot.start_time_local.hour * 60 + slot.start_time_local.minute
        if not start <= slot_minutes <= end:
            continue
        # A preference is strict by default. This prevents a broad 12:00–17:00
        # rule from taking a different user's preferred time just because its
        # own preferred time was unavailable.
        if rule.preferred_start_time and not rule.allow_fallback and slot.start_time_local.strftime("%H:%M") != rule.preferred_start_time:
            continue
        if rule.max_price_pence is not None and slot.price_pence is not None and slot.price_pence > rule.max_price_pence:
            continue
        matched.append(slot)
    return matched


def slot_groups(rule: RuleOut, slots: list[Slot]) -> list[list[Slot]]:
    """Return every contiguous one-hour group, ordered by that rule's preference."""
    needed = rule.duration_minutes // 60
    by_resource: dict[tuple[str, str], dict[int, Slot]] = {}
    for slot in slots:
        by_resource.setdefault((slot.activity_id, slot.bookable_item_id), {})[slot.start_time_utc] = slot
    candidates: list[list[Slot]] = []
    for resource_slots in by_resource.values():
        for start_utc, start_slot in resource_slots.items():
            group = [resource_slots.get(start_utc + hour * 3600) for hour in range(needed)]
            if all(group):
                candidates.append(group)  # type: ignore[arg-type]
    def sort_key(group: list[Slot]) -> tuple[int, int, int]:
        start = group[0].start_time_local
        minute = start.hour * 60 + start.minute
        preferred = _parse_minutes(rule.preferred_start_time) if rule.preferred_start_time else minute
        return (0 if minute == preferred else 1, abs(minute - preferred), group[0].start_time_utc)

    return sorted(candidates, key=sort_key)


def select_slot_group(rule: RuleOut, slots: list[Slot]) -> list[Slot] | None:
    groups = slot_groups(rule, slots)
    return groups[0] if groups else None


class RuleStore:
    def __init__(self, settings: Settings, user_id: int | None = None, is_admin: bool = True):
        self.settings = settings
        self.user_id = user_id
        self.is_admin = is_admin

    def _owned_clause(self) -> tuple[str, tuple]:
        if self.is_admin:
            return "", ()
        return " WHERE user_id = ?", (self.user_id,)

    def list_rules(self) -> list[RuleOut]:
        with get_conn(self.settings.database_path) as conn:
            clause, params = self._owned_clause()
            rows = conn.execute(f"SELECT * FROM rules{clause} ORDER BY enabled DESC, id DESC", params).fetchall()
        return [_row_to_rule(row) for row in rows]

    def get_rule(self, rule_id: int) -> RuleOut:
        with get_conn(self.settings.database_path) as conn:
            clause, params = self._owned_clause()
            connector = " AND" if clause else " WHERE"
            row = conn.execute(f"SELECT * FROM rules{clause}{connector} id = ?", (*params, rule_id)).fetchone()
        if row is None:
            raise KeyError(rule_id)
        return _row_to_rule(row)

    def create_rule(self, rule: RuleCreate) -> RuleOut:
        now = iso_now()
        with get_conn(self.settings.database_path) as conn:
            cursor = conn.execute(
                """
                INSERT INTO rules (
                    name, sport, enabled, activity_ids, days_of_week, start_time, end_time,
                    lookahead_days, run_interval_minutes, max_price_pence,
                    notify_on_success, notify_on_failure, notify_on_availability,
                    created_at, updated_at, user_id, aston_account_id, duration_minutes,
                    preferred_start_time, allow_fallback
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rule.name,
                    rule.sport,
                    int(rule.enabled),
                    encode_json(rule.activity_ids),
                    encode_json(rule.days_of_week),
                    rule.start_time,
                    rule.end_time,
                    rule.lookahead_days,
                    rule.run_interval_minutes,
                    rule.max_price_pence,
                    int(rule.notify_on_success),
                    int(rule.notify_on_failure),
                    int(rule.notify_on_availability),
                    now,
                    now,
                    self.user_id,
                    rule.aston_account_id,
                    rule.duration_minutes,
                    rule.preferred_start_time,
                    int(rule.allow_fallback),
                ),
            )
            rule_id = int(cursor.lastrowid)
        return self.get_rule(rule_id)

    def update_rule(self, rule_id: int, update: RuleUpdate) -> RuleOut:
        existing = self.get_rule(rule_id)
        data = existing.model_dump()
        for key, value in update.model_dump(exclude_unset=True).items():
            data[key] = value
        updated = RuleCreate(**{key: data[key] for key in RuleCreate.model_fields})
        with get_conn(self.settings.database_path) as conn:
            conn.execute(
                """
                UPDATE rules
                SET name = ?, sport = ?, enabled = ?, activity_ids = ?, days_of_week = ?,
                    start_time = ?, end_time = ?, lookahead_days = ?, run_interval_minutes = ?,
                    max_price_pence = ?, notify_on_success = ?, notify_on_failure = ?,
                    notify_on_availability = ?, aston_account_id = ?, duration_minutes = ?,
                    preferred_start_time = ?, allow_fallback = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    updated.name,
                    updated.sport,
                    int(updated.enabled),
                    encode_json(updated.activity_ids),
                    encode_json(updated.days_of_week),
                    updated.start_time,
                    updated.end_time,
                    updated.lookahead_days,
                    updated.run_interval_minutes,
                    updated.max_price_pence,
                    int(updated.notify_on_success),
                    int(updated.notify_on_failure),
                    int(updated.notify_on_availability),
                    updated.aston_account_id,
                    updated.duration_minutes,
                    updated.preferred_start_time,
                    int(updated.allow_fallback),
                    iso_now(),
                    rule_id,
                ),
            )
        return self.get_rule(rule_id)

    def delete_rule(self, rule_id: int) -> None:
        # Resolve through the scoped getter first so a normal user cannot delete
        # another user's rule by guessing its numeric id.
        self.get_rule(rule_id)
        with get_conn(self.settings.database_path) as conn:
            conn.execute("DELETE FROM rules WHERE id = ?", (rule_id,))

    def mark_run(self, rule_id: int) -> None:
        with get_conn(self.settings.database_path) as conn:
            conn.execute("UPDATE rules SET last_run_at = ?, updated_at = ? WHERE id = ?", (iso_now(), iso_now(), rule_id))

    def due_rules(self) -> list[RuleOut]:
        rules = [rule for rule in self.list_rules() if rule.enabled]
        now = utc_now()
        due: list[RuleOut] = []
        for rule in rules:
            if rule.last_run_at is None:
                due.append(rule)
                continue
            last_run = rule.last_run_at
            if last_run.tzinfo is None:
                last_run = last_run.replace(tzinfo=now.tzinfo)
            if last_run + timedelta(minutes=rule.run_interval_minutes) <= now:
                due.append(rule)
        return due


class BookingService:
    def __init__(self, settings: Settings, client: SportAstonClient | None = None, notifier: Notifier | None = None, user_id: int | None = None, aston_account_id: int | None = None):
        self.settings = settings
        self.client = client or SportAstonClient(settings)
        self.notifier = notifier or Notifier(settings)
        self.user_id = user_id
        self.aston_account_id = aston_account_id

    def _record_attempt(
        self,
        slot: Slot,
        status: str,
        source: str,
        rule_id: int | None = None,
        response: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> BookingAttemptOut:
        response_type = response.get("responseDocType") if response else None
        with get_conn(self.settings.database_path) as conn:
            cursor = conn.execute(
                """
                INSERT INTO booking_attempts (
                    created_at, sport, activity_id, activity_name, bookable_item_id,
                    bookable_item_name, start_time_utc, start_time_local, price, status,
                    source, rule_id, response_type, response_json, error, slot_identity, user_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    iso_now(),
                    slot.sport,
                    slot.activity_id,
                    slot.activity_name,
                    slot.bookable_item_id,
                    slot.bookable_item_name,
                    slot.start_time_utc,
                    slot.start_time_local.isoformat(),
                    slot.price,
                    status,
                    source,
                    rule_id,
                    response_type,
                    json.dumps(response) if response is not None else None,
                    error,
                    slot.identity,
                    self.user_id,
                ),
            )
            row = conn.execute("SELECT * FROM booking_attempts WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return _row_to_attempt(row)

    def has_successful_booking(self, slot: Slot) -> bool:
        with get_conn(self.settings.database_path) as conn:
            row = conn.execute(
                "SELECT 1 FROM booking_attempts WHERE slot_identity = ? AND status = 'success' AND user_id IS ? LIMIT 1",
                (slot.identity, self.user_id),
            ).fetchone()
        return row is not None

    def _record_hold(self, slots: list[Slot], rule_id: int | None = None) -> None:
        if not slots or self.user_id is None:
            return
        with get_conn(self.settings.database_path) as conn:
            conn.execute(
                "INSERT INTO booking_holds (id, user_id, aston_account_id, rule_id, start_time_local, duration_minutes, slot_identities, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'held', ?)",
                (str(uuid.uuid4()), self.user_id, self.aston_account_id, rule_id, slots[0].start_time_local.isoformat(), len(slots) * 60, encode_json([slot.identity for slot in slots]), iso_now()),
            )

    def _notify(self, title: str, message: str) -> None:
        notify_for_user = getattr(self.notifier, "notify_for_user", None)
        if notify_for_user:
            notify_for_user(self.user_id, title, message)
        else:
            self.notifier.notify(title, message)

    def book(self, slot: Slot, source: str = "manual", rule: RuleOut | None = None) -> BookingAttemptOut:
        rule_id = rule.id if rule else None
        reservation_id = None
        if self.aston_account_id is not None and self.user_id is not None:
            reservation_id = SlotReservationStore(self.settings).reserve(self.aston_account_id, [slot.identity], self.user_id)
            if reservation_id is None:
                return self._record_attempt(slot, "skipped", source, rule_id, error="Slot is already being booked or has been booked through this Aston account")
        try:
            response = self.client.book_slot(slot)
            status = "success" if response.get("responseDocType") == "BOOKING_SUCCESS" else "failure"
            attempt = self._record_attempt(slot, status, source, rule_id, response=response)
            if reservation_id:
                SlotReservationStore(self.settings).finish(reservation_id, status == "success")
            if status == "success":
                self._record_hold([slot], rule_id)
            if status == "success" and (rule is None or rule.notify_on_success):
                self._notify("Basketball Booker", f"Booked {slot.activity_name} at {slot.start_time_local:%A %d %B %Y %H:%M}")
            elif status == "failure" and (rule is None or rule.notify_on_failure):
                self._notify("Basketball Booker Failure", f"Failed to book {slot.activity_name} at {slot.start_time_local:%A %d %B %Y %H:%M}")
            return attempt
        except Exception as exc:
            if reservation_id:
                SlotReservationStore(self.settings).finish(reservation_id, False)
            attempt = self._record_attempt(slot, "failure", source, rule_id, error=str(exc))
            if rule is None or rule.notify_on_failure:
                self._notify("Basketball Booker Failure", f"Failed to book {slot.activity_name}: {exc}")
            return attempt

    def book_group(self, slots: list[Slot], source: str, rule: RuleOut) -> list[BookingAttemptOut]:
        if not slots:
            return []
        reservation_id = None
        if self.aston_account_id is not None and self.user_id is not None:
            reservation_id = SlotReservationStore(self.settings).reserve(self.aston_account_id, [slot.identity for slot in slots], self.user_id)
            if reservation_id is None:
                return [self._record_attempt(slot, "skipped", source, rule.id, error="Slot is already being booked or has been booked through this Aston account") for slot in slots]
        try:
            response = self.client.book_slots(slots)
            status = "success" if response.get("responseDocType") == "BOOKING_SUCCESS" else "failure"
            attempts = [self._record_attempt(slot, status, source, rule.id, response=response) for slot in slots]
            if reservation_id:
                SlotReservationStore(self.settings).finish(reservation_id, status == "success")
            if status == "success":
                self._record_hold(slots, rule.id)
            if status == "success" and rule.notify_on_success:
                self._notify("Basketball Booker", f"Booked {len(slots)} hour(s) for {rule.name}, starting {slots[0].start_time_local:%A %d %B %H:%M}")
            elif status == "failure" and rule.notify_on_failure:
                self._notify("Basketball Booker Failure", f"Failed to book {rule.name}")
            return attempts
        except Exception as exc:
            if reservation_id:
                SlotReservationStore(self.settings).finish(reservation_id, False)
            return [self._record_attempt(slot, "failure", source, rule.id, error=str(exc)) for slot in slots]


class RuleRunner:
    def __init__(self, settings: Settings, client: SportAstonClient | None = None, user_id: int | None = None, is_admin: bool = True):
        self.settings = settings
        self.store = RuleStore(settings, user_id=user_id, is_admin=is_admin)
        self.client = client or SportAstonClient(settings)
        self.booking_service = BookingService(settings, self.client, user_id=user_id)

    def run_rule(self, rule_id: int) -> RuleRunResponse:
        rule = self.store.get_rule(rule_id)
        # A scheduled admin runner may execute rules belonging to many users.
        # Keep duplicate detection and audit records attached to that rule's owner.
        client = self.client
        if rule.aston_account_id is not None:
            client = SportAstonClient(self.settings, AstonAccountStore(self.settings).credentials(rule.aston_account_id))
        booking_service = BookingService(self.settings, client, user_id=rule.user_id, aston_account_id=rule.aston_account_id)
        attempts: list[BookingAttemptOut] = []
        try:
            slots = client.get_availability(rule.sport, rule.lookahead_days)
            matched = filter_slots(rule, slots)
            self._record_check(rule, "success", len(slots), len(matched))
            if matched and rule.notify_on_availability:
                Notifier(self.settings).notify_for_user(rule.user_id, "Basketball Booker Availability", f"{rule.name} matched {len(matched)} slot(s)")
            group = select_slot_group(rule, matched)
            if group:
                attempts.extend(booking_service.book_group(group, source="rule", rule=rule))
            self.store.mark_run(rule.id)
            return RuleRunResponse(rule=self.store.get_rule(rule.id), checked_slots=len(slots), matched_slots=len(matched), booking_attempts=attempts)
        except Exception as exc:
            self._record_check(rule, "failure", 0, 0, str(exc))
            self.store.mark_run(rule.id)
            raise

    def run_fair_for_rule(self, rule_id: int) -> RuleRunResponse:
        """Manually trigger the same account-wide allocator used by the scheduler."""
        target = self.store.get_rule(rule_id)
        global_rules = RuleStore(self.settings).list_rules()
        contenders = [rule for rule in global_rules if rule.enabled and rule.aston_account_id == target.aston_account_id]
        self._allocate_account(target.aston_account_id, contenders)
        with get_conn(self.settings.database_path) as conn:
            attempts = conn.execute("SELECT * FROM booking_attempts WHERE rule_id = ? ORDER BY id DESC LIMIT 20", (target.id,)).fetchall()
            check = conn.execute("SELECT slot_count, matched_count FROM availability_checks WHERE rule_id = ? ORDER BY id DESC LIMIT 1", (target.id,)).fetchone()
        return RuleRunResponse(
            rule=self.store.get_rule(rule_id),
            checked_slots=check["slot_count"] if check else 0,
            matched_slots=check["matched_count"] if check else 0,
            booking_attempts=[_row_to_attempt(row) for row in attempts],
        )

    def run_due_rules(self) -> None:
        # Rules which share an Aston account are allocated together. This is
        # deliberately not a simple loop over rules: a 15:00 preference must
        # beat another user's 15:00 fallback regardless of run order.
        due = self.store.due_rules()
        # Once any rule for an Aston account is due, compare it with every
        # enabled rule that can contend for the same account. Otherwise a rule
        # on a longer interval could lose its preferred time to a frequent
        # fallback rule simply because it was not due in that minute.
        all_enabled = [rule for rule in self.store.list_rules() if rule.enabled]
        by_account: dict[int | None, list[RuleOut]] = {}
        for account_id in {rule.aston_account_id for rule in due}:
            by_account[account_id] = [rule for rule in all_enabled if rule.aston_account_id == account_id]
        for account_id, rules in by_account.items():
            try:
                self._allocate_account(account_id, rules)
            except Exception:
                # Individual failures are recorded by the allocation pass; the
                # scheduler should continue serving other Aston accounts.
                continue

    def _last_booking_by_user(self, user_ids: set[int | None]) -> dict[int | None, datetime]:
        result: dict[int | None, datetime] = {}
        ids = [user_id for user_id in user_ids if user_id is not None]
        if not ids:
            return result
        placeholders = ",".join("?" for _ in ids)
        with get_conn(self.settings.database_path) as conn:
            rows = conn.execute(
                f"SELECT user_id, MAX(created_at) AS last_booking FROM booking_attempts WHERE status = 'success' AND user_id IN ({placeholders}) GROUP BY user_id",
                ids,
            ).fetchall()
        for row in rows:
            result[row["user_id"]] = datetime.fromisoformat(row["last_booking"])
        return result

    def _allocate_account(self, account_id: int | None, rules: list[RuleOut]) -> None:
        client = self.client
        if account_id is not None:
            client = SportAstonClient(self.settings, AstonAccountStore(self.settings).credentials(account_id))
        availability: dict[tuple[str, int], list[Slot]] = {}
        candidates: list[tuple[int, RuleOut, list[Slot]]] = []
        for rule in rules:
            key = (rule.sport, rule.lookahead_days)
            try:
                if key not in availability:
                    availability[key] = client.get_availability(rule.sport, rule.lookahead_days)
                slots = availability[key]
                matched = filter_slots(rule, slots)
                self._record_check(rule, "success", len(slots), len(matched))
                if matched and rule.notify_on_availability:
                    Notifier(self.settings).notify_for_user(rule.user_id, "Basketball Booker Availability", f"{rule.name} matched {len(matched)} slot(s)")
                groups = slot_groups(rule, matched)
                preferred = _parse_minutes(rule.preferred_start_time) if rule.preferred_start_time else None
                for group in groups:
                    start_minutes = group[0].start_time_local.hour * 60 + group[0].start_time_local.minute
                    # 0 exact preference, 1 explicit fallback, 2 no preference.
                    tier = 0 if preferred is not None and start_minutes == preferred else (1 if preferred is not None else 2)
                    candidates.append((tier, rule, group))
            except Exception as exc:
                self._record_check(rule, "failure", 0, 0, str(exc))
                self.store.mark_run(rule.id)

        last_booking = self._last_booking_by_user({rule.user_id for _, rule, _ in candidates})
        claimed: set[str] = set()
        assigned_rules: set[int] = set()
        # Exact preferred starts are processed globally before fallbacks, which
        # are processed before users who expressed no time preference.
        candidates.sort(key=lambda item: (
            item[0],
            last_booking.get(item[1].user_id, datetime.min.replace(tzinfo=item[1].created_at.tzinfo)),
            item[1].created_at,
            item[2][0].start_time_utc,
        ))
        for tier, rule, group in candidates:
            if rule.id in assigned_rules:
                continue
            identities = {slot.identity for slot in group}
            if identities & claimed:
                continue
            service = BookingService(self.settings, client, user_id=rule.user_id, aston_account_id=account_id)
            attempts = service.book_group(group, source="rule", rule=rule)
            if any(attempt.status == "success" for attempt in attempts):
                claimed.update(identities)
                assigned_rules.add(rule.id)
            self.store.mark_run(rule.id)
        # Rules with no valid candidate still count as checked for their interval.
        for rule in rules:
            if rule.id not in assigned_rules:
                self.store.mark_run(rule.id)

    def _record_check(self, rule: RuleOut, status: str, slot_count: int, matched_count: int, error: str | None = None) -> None:
        with get_conn(self.settings.database_path) as conn:
            conn.execute(
                """
                INSERT INTO availability_checks (created_at, sport, rule_id, status, slot_count, matched_count, error, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (iso_now(), rule.sport, rule.id, status, slot_count, matched_count, error, rule.user_id),
            )
