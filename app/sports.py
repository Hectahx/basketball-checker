from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Activity:
    id: str
    name: str


@dataclass(frozen=True)
class Sport:
    id: str
    label: str
    activities: tuple[Activity, ...]


SPORTS: dict[str, Sport] = {
    "basketball": Sport(
        id="basketball",
        label="Basketball",
        activities=(
            Activity(id="WSCACT0009", name="Sports Hall 1"),
            Activity(id="WSCACT0010", name="Sports Hall 2"),
        ),
    ),
    "badminton": Sport(
        id="badminton",
        label="Badminton",
        activities=(
            Activity(id="WSCACT0001", name="Sports Hall 1"),
            Activity(id="WSCACT0004", name="Sports Hall 2"),
        ),
    ),
}


def get_sport(sport_id: str) -> Sport:
    try:
        return SPORTS[sport_id]
    except KeyError as exc:
        raise ValueError(f"Unknown sport: {sport_id}") from exc


def get_activity_name(sport_id: str, activity_id: str) -> str:
    sport = get_sport(sport_id)
    for activity in sport.activities:
        if activity.id == activity_id:
            return activity.name
    return activity_id
