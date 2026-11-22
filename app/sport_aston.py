from __future__ import annotations

import re
import time
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import requests

from .config import Settings
from .models import Slot
from .sports import get_activity_name, get_sport


AUTHENTICATION_KEY = "M0bi1eProB00king$"
BASE_URL = "https://sportaston.gs-signature.cloud/AWS/api"


def parse_price_pence(price: str | None) -> int | None:
    if not price:
        return None
    match = re.search(r"(\d+(?:\.\d{1,2})?)", price.replace(",", ""))
    if not match:
        return None
    return int(round(float(match.group(1)) * 100))


class SportAstonClient:
    def __init__(self, settings: Settings, credentials: tuple[str | None, str | None] | None = None):
        self.settings = settings
        self.credentials = credentials or (settings.sport_aston_user, settings.sport_aston_password)

    def _base_headers(self) -> dict[str, str]:
        return {
            "accept": "application/json",
            "authenticationkey": AUTHENTICATION_KEY,
            "content-type": "application/json",
            "accept-language": "en-GB;q=1.0, ar-GB;q=0.9",
            "user-agent": "iPhone",
        }

    def get_jwt_token(self) -> str:
        username, password = self.credentials
        if not username or not password:
            raise RuntimeError("Sport Aston credentials are not configured")
        response = requests.get(
            f"{BASE_URL}/token",
            headers={
                **self._base_headers(),
                "user": username,
                "pw": password,
            },
            params={"locale": "en_GB"},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        return data["jwtToken"]

    def _auth_headers(self, auth_token: str) -> dict[str, str]:
        return {**self._base_headers(), "authorisation": f"Bearer {auth_token}"}

    def get_availability(self, sport_id: str, lookahead_days: int = 10) -> list[Slot]:
        sport = get_sport(sport_id)
        auth_token = self.get_jwt_token()
        now = int(time.time())
        to_utc = now + lookahead_days * 24 * 60 * 60
        slots: list[Slot] = []
        tz = ZoneInfo(self.settings.timezone)

        for activity in sport.activities:
            response = requests.get(
                f"{BASE_URL}/activity/availability",
                headers=self._auth_headers(auth_token),
                params={
                    "toUTC": to_utc,
                    "fromUTC": now,
                    "activityId": activity.id,
                    "locale": "en_GB",
                },
                timeout=20,
            )
            response.raise_for_status()
            data = response.json()
            for item in data.get("bookableItems", []):
                bookable_item_id = item.get("id", "")
                bookable_item_name = item.get("n", activity.name)
                for raw_slot in item.get("slots", []):
                    start_utc = int(raw_slot["sUTC"])
                    start_local = datetime.fromtimestamp(start_utc, tz=UTC).astimezone(tz)
                    price = raw_slot.get("p") or None
                    status = int(raw_slot.get("s", 0))
                    slots.append(
                        Slot(
                            sport=sport.id,
                            activity_id=activity.id,
                            activity_name=activity.name,
                            bookable_item_id=bookable_item_id,
                            bookable_item_name=bookable_item_name,
                            start_time_utc=start_utc,
                            start_time_local=start_local,
                            price=price,
                            price_pence=parse_price_pence(price),
                            status=status,
                            available=bool(price and status == 1),
                        )
                    )
        return slots

    def book_slot(self, slot: Slot) -> dict:
        return self.book_slots([slot])

    def book_slots(self, slots: list[Slot]) -> dict:
        if not slots:
            raise ValueError("Choose at least one slot")
        auth_token = self.get_jwt_token()
        response = requests.post(
            f"{BASE_URL}/Book",
            headers=self._auth_headers(auth_token),
            json={
                "locale": "en_GB",
                "items": [
                    {
                        "includeKeyBookee": "true",
                        "type": "activity",
                        "activity": {
                            "bookableItemId": slot.bookable_item_id,
                            "activityId": slot.activity_id,
                            "startTimeUTC": slot.start_time_utc,
                        },
                    }
                    for slot in slots
                ],
            },
            timeout=20,
        )
        response.raise_for_status()
        return response.json()


def slot_from_booking_request(settings: Settings, request) -> Slot:
    tz = ZoneInfo(settings.timezone)
    activity_name = get_activity_name(request.sport, request.activity_id)
    return Slot(
        sport=request.sport,
        activity_id=request.activity_id,
        activity_name=activity_name,
        bookable_item_id=request.bookable_item_id,
        bookable_item_name=request.bookable_item_name or activity_name,
        start_time_utc=request.start_time_utc,
        start_time_local=datetime.fromtimestamp(request.start_time_utc, tz=UTC).astimezone(tz),
        price=request.price,
        price_pence=parse_price_pence(request.price),
        status=1,
        available=True,
    )
