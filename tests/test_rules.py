from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.config import Settings
from app.database import init_db
from app.models import RuleOut, Slot
from app.rules import BookingService, filter_slots, select_slot_group
from app.sport_aston import parse_price_pence


def make_rule(**overrides) -> RuleOut:
    data = {
        "id": 1,
        "name": "Weekend basketball",
        "sport": "basketball",
        "enabled": True,
        "activity_ids": ["WSCACT0009"],
        "days_of_week": [5],
        "start_time": "12:00",
        "end_time": "19:00",
        "lookahead_days": 10,
        "run_interval_minutes": 5,
        "max_price_pence": None,
        "notify_on_success": True,
        "notify_on_failure": True,
        "notify_on_availability": False,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
        "last_run_at": None,
    }
    data.update(overrides)
    return RuleOut(**data)


def make_slot(**overrides) -> Slot:
    london = ZoneInfo("Europe/London")
    data = {
        "sport": "basketball",
        "activity_id": "WSCACT0009",
        "activity_name": "Sports Hall 1",
        "bookable_item_id": "item-1",
        "bookable_item_name": "Sports Hall 1",
        "start_time_utc": 1781962200,
        "start_time_local": datetime(2026, 6, 20, 16, 30, tzinfo=london),
        "price": "£30.00",
        "price_pence": 3000,
        "status": 1,
        "available": True,
    }
    data.update(overrides)
    return Slot(**data)


def make_settings(database_path: Path) -> Settings:
    return Settings(
        sport_aston_user="user",
        sport_aston_password="pw",
        pushover_api_token=None,
        pushover_user_key=None,
        discord_webhook_url=None,
        discord_mention=None,
        app_password="admin",
        app_secret="secret",
        database_path=database_path,
        timezone="Europe/London",
        scheduler_enabled=False,
    )


class FakeClient:
    def book_slot(self, slot: Slot) -> dict:
        return {"responseDocType": "BOOKING_SUCCESS"}


class FakeNotifier:
    def notify(self, title: str, message: str) -> None:
        return None


def test_filter_slots_matches_weekend_time_and_activity() -> None:
    rule = make_rule()
    matching = make_slot()
    wrong_activity = make_slot(activity_id="WSCACT0010")
    unavailable = make_slot(available=False)
    late = make_slot(start_time_local=datetime(2026, 6, 20, 20, 30, tzinfo=ZoneInfo("Europe/London")))

    assert filter_slots(rule, [matching, wrong_activity, unavailable, late]) == [matching]


def test_filter_slots_applies_max_price_when_present() -> None:
    rule = make_rule(max_price_pence=2500)

    assert filter_slots(rule, [make_slot(price_pence=3000)]) == []
    assert filter_slots(rule, [make_slot(price_pence=2000)]) == [make_slot(price_pence=2000)]


def test_strict_preferred_time_does_not_fall_back_to_another_slot() -> None:
    rule = make_rule(preferred_start_time="16:30", allow_fallback=False)
    assert filter_slots(rule, [make_slot(), make_slot(start_time_utc=1781951400, start_time_local=datetime(2026, 6, 20, 13, 30, tzinfo=ZoneInfo("Europe/London")))]) == [make_slot()]


def test_select_slot_group_requires_consecutive_slots() -> None:
    rule = make_rule(duration_minutes=120, preferred_start_time="16:30")
    first = make_slot()
    second = make_slot(start_time_utc=first.start_time_utc + 3600, start_time_local=datetime(2026, 6, 20, 17, 30, tzinfo=ZoneInfo("Europe/London")))
    assert select_slot_group(rule, [first, second]) == [first, second]


def test_parse_price_pence() -> None:
    assert parse_price_pence("£30.00") == 3000
    assert parse_price_pence("£7.50") == 750
    assert parse_price_pence("") is None


def test_booking_service_records_success_and_duplicate_identity(tmp_path: Path) -> None:
    db_path = tmp_path / "booker.sqlite3"
    init_db(db_path)
    settings = make_settings(db_path)
    service = BookingService(settings, client=FakeClient(), notifier=FakeNotifier())
    slot = make_slot()

    attempt = service.book(slot)

    assert attempt.status == "success"
    assert service.has_successful_booking(slot) is True
