from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("BOOKER_DB_PATH", str(tmp_path / "booker.sqlite3"))
    monkeypatch.setenv("APP_PASSWORD", "admin-password")
    monkeypatch.setenv("APP_SECRET", "test-secret")
    monkeypatch.setenv("SCHEDULER_ENABLED", "false")
    from app.server import create_app

    return TestClient(create_app())


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def _invite(client: TestClient, admin: dict[str, str]) -> str:
    response = client.post("/api/invites", json={"shared_access": True}, headers=admin)
    assert response.status_code == 201
    return response.json()["invite_url"].split("invite=")[1]


def test_two_invitees_can_both_add_a_default_private_account(client: TestClient) -> None:
    admin = _login(client, "admin", "admin-password")
    for name in ("friend", "another"):
        response = client.post(
            "/api/invites/accept",
            json={"token": _invite(client, admin), "username": name, "password": "password123", "use_shared_account": True, "aston_username": "a", "aston_password": "b"},
        )
        assert response.status_code == 200, response.text
        accounts = client.get("/api/aston-accounts", headers={"Authorization": f"Bearer {response.json()['token']}"}).json()
        assert sorted(account["credential_mode"] for account in accounts) == ["environment", "stored"]


def test_failed_invite_leaves_no_user_and_keeps_the_invite(client: TestClient) -> None:
    admin = _login(client, "admin", "admin-password")
    token = _invite(client, admin)
    taken = client.post("/api/invites/accept", json={"token": token, "username": "admin", "password": "password123"})
    assert taken.status_code == 409
    retry = client.post("/api/invites/accept", json={"token": token, "username": "friend", "password": "password123"})
    assert retry.status_code == 200, retry.text


def test_rules_are_private_and_editable_by_their_owner(client: TestClient) -> None:
    admin = _login(client, "admin", "admin-password")
    friend_token = client.post("/api/invites/accept", json={"token": _invite(client, admin), "username": "friend", "password": "password123"}).json()["token"]
    friend = {"Authorization": f"Bearer {friend_token}"}

    created = client.post("/api/rules", json={"name": "Saturday", "sport": "basketball", "days_of_week": [5]}, headers=friend)
    assert created.status_code == 200, created.text
    rule = created.json()
    assert rule["owner_username"] == "friend"

    edited = client.patch(f"/api/rules/{rule['id']}", json={"preferred_start_time": "15:30", "duration_minutes": 120}, headers=friend)
    assert edited.status_code == 200
    assert edited.json()["preferred_start_time"] == "15:30"

    client.post("/api/users", json={"username": "third", "password": "password123"}, headers=admin)
    third = _login(client, "third", "password123")
    assert client.get("/api/rules", headers=third).json() == []
    assert client.patch(f"/api/rules/{rule['id']}", json={"enabled": False}, headers=third).status_code == 404
    assert client.delete(f"/api/rules/{rule['id']}", headers=third).status_code == 404
    assert len(client.get("/api/rules", headers=admin).json()) == 1


def test_holds_and_history_start_empty(client: TestClient) -> None:
    admin = _login(client, "admin", "admin-password")
    assert client.get("/api/holds", headers=admin).json() == []
    assert client.get("/api/history", headers=admin).json() == {"booking_attempts": [], "availability_checks": []}


def test_a_rule_that_has_run_can_still_be_deleted(client: TestClient) -> None:
    from app.config import get_settings
    from app.database import get_conn

    admin = _login(client, "admin", "admin-password")
    rule = client.post("/api/rules", json={"name": "Ran once", "sport": "basketball"}, headers=admin).json()
    with get_conn(get_settings().database_path) as conn:
        conn.execute("INSERT INTO availability_checks (created_at, sport, rule_id, status, slot_count, matched_count, user_id) VALUES ('2026-11-22T00:00:00+00:00', 'basketball', ?, 'success', 4, 0, 1)", (rule["id"],))
    listed = client.get("/api/rules", headers=admin).json()[0]
    assert listed["last_check_status"] == "success" and listed["last_check_slots"] == 4
    assert client.delete(f"/api/rules/{rule['id']}", headers=admin).status_code == 200
    assert client.get("/api/history", headers=admin).json()["availability_checks"][0]["rule_id"] is None
