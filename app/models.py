from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    username: str = "admin"
    password: str


class LoginResponse(BaseModel):
    token: str
    expires_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=256)
    role: Literal["admin", "user"] = "user"
    shared_access: bool = True


class UserOut(BaseModel):
    id: int
    username: str
    role: Literal["admin", "user"]
    enabled: bool
    created_at: datetime
    shared_access: bool = False


class UserUpdate(BaseModel):
    enabled: bool | None = None
    role: Literal["admin", "user"] | None = None


class InviteCreate(BaseModel):
    shared_access: bool = True


class InviteOut(BaseModel):
    id: int
    invite_url: str
    shared_access: bool
    expires_at: datetime


class InviteAccept(BaseModel):
    token: str
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=256)
    use_shared_account: bool = True
    private_account_label: str | None = None
    aston_username: str | None = None
    aston_password: str | None = None


class HoldOut(BaseModel):
    id: str
    user_id: int
    username: str | None = None
    aston_account_id: int | None
    rule_id: int | None
    rule_name: str | None = None
    start_time_local: datetime
    duration_minutes: int
    status: str
    created_at: datetime
    sport: str | None = None
    activity_name: str | None = None
    bookable_item_name: str | None = None
    price: str | None = None
    slot_identities: list[str] = Field(default_factory=list)


class ActivityOut(BaseModel):
    id: str
    name: str


class SportOut(BaseModel):
    id: str
    label: str
    activities: list[ActivityOut]


class Slot(BaseModel):
    sport: str
    activity_id: str
    activity_name: str
    bookable_item_id: str
    bookable_item_name: str
    start_time_utc: int
    start_time_local: datetime
    price: str | None = None
    price_pence: int | None = None
    status: int
    available: bool

    @property
    def identity(self) -> str:
        return f"{self.sport}:{self.activity_id}:{self.bookable_item_id}:{self.start_time_utc}"


class AvailabilityResponse(BaseModel):
    sport: str
    checked_at: datetime
    slots: list[Slot]


class BookingRequest(BaseModel):
    sport: str
    activity_id: str
    bookable_item_id: str
    start_time_utc: int
    bookable_item_name: str | None = None
    price: str | None = None
    source: Literal["manual", "rule"] = "manual"
    rule_id: int | None = None
    aston_account_id: int | None = None


class BookingAttemptOut(BaseModel):
    id: int
    created_at: datetime
    sport: str
    activity_id: str
    activity_name: str
    bookable_item_id: str
    bookable_item_name: str
    start_time_utc: int
    start_time_local: datetime
    price: str | None
    status: str
    source: str
    rule_id: int | None
    user_id: int | None = None
    username: str | None = None
    response_type: str | None
    error: str | None


class RuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sport: str
    enabled: bool = True
    activity_ids: list[str] = Field(default_factory=list)
    days_of_week: list[int] = Field(default_factory=lambda: [5, 6])
    start_time: str = "12:00"
    end_time: str = "22:00"
    lookahead_days: int = Field(default=10, ge=1, le=31)
    run_interval_minutes: int = Field(default=5, ge=1, le=1440)
    max_price_pence: int | None = Field(default=None, ge=0)
    notify_on_success: bool = True
    notify_on_failure: bool = True
    notify_on_availability: bool = False
    aston_account_id: int | None = None
    duration_minutes: int = Field(default=60, ge=60, le=240, multiple_of=60)
    preferred_start_time: str | None = None
    allow_fallback: bool = False

    @field_validator("days_of_week")
    @classmethod
    def validate_days(cls, days: list[int]) -> list[int]:
        if not days:
            raise ValueError("Choose at least one day")
        invalid = [day for day in days if day < 0 or day > 6]
        if invalid:
            raise ValueError("Days must be 0-6, where 0 is Monday")
        return sorted(set(days))

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        parts = value.split(":")
        if len(parts) != 2:
            raise ValueError("Time must use HH:MM")
        hour, minute = int(parts[0]), int(parts[1])
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("Time must use HH:MM")
        return f"{hour:02d}:{minute:02d}"

    @field_validator("preferred_start_time")
    @classmethod
    def validate_preferred_time(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        return cls.validate_time(value)


class RuleCreate(RuleBase):
    pass


class RuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    sport: str | None = None
    enabled: bool | None = None
    activity_ids: list[str] | None = None
    days_of_week: list[int] | None = None
    start_time: str | None = None
    end_time: str | None = None
    lookahead_days: int | None = Field(default=None, ge=1, le=31)
    run_interval_minutes: int | None = Field(default=None, ge=1, le=1440)
    max_price_pence: int | None = Field(default=None, ge=0)
    notify_on_success: bool | None = None
    notify_on_failure: bool | None = None
    notify_on_availability: bool | None = None
    aston_account_id: int | None = None
    duration_minutes: int | None = Field(default=None, ge=60, le=240, multiple_of=60)
    preferred_start_time: str | None = None
    allow_fallback: bool | None = None


class RuleOut(RuleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_run_at: datetime | None = None
    user_id: int | None = None
    owner_username: str | None = None
    last_check_status: str | None = None
    last_check_at: datetime | None = None
    last_check_slots: int | None = None
    last_check_matched: int | None = None
    last_check_error: str | None = None


class AstonAccountOut(BaseModel):
    id: int
    label: str
    credential_mode: Literal["environment", "stored"]


class AstonAccountCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    member_user_id: int | None = None


class NotificationPreferences(BaseModel):
    discord_webhook_url: str | None = None


class RuleRunResponse(BaseModel):
    rule: RuleOut
    checked_slots: int
    matched_slots: int
    booking_attempts: list[BookingAttemptOut]


class HistoryResponse(BaseModel):
    booking_attempts: list[BookingAttemptOut]
    availability_checks: list[dict[str, Any]]
