from __future__ import annotations

import json
import time
from contextlib import contextmanager
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from kubepilot.api.main import app
from kubepilot.core.settings import Settings, get_settings


@contextmanager
def _fake_session_scope():
    yield MagicMock()


def test_session_google_sets_session_cookie() -> None:
    settings = get_settings()
    exchange_code = "test-exchange-code-12345678"
    payload = json.dumps({"user_email": "user@example.com", "display_name": "Test User"})
    uid = uuid4()
    user_row = MagicMock()
    user_row.id = uid
    user_row.email = "user@example.com"
    user_row.display_name = "Test User"

    class FakeRedis:
        async def get(self, key: str) -> str | None:
            if key == f"auth:sso:exchange:{exchange_code}":
                return payload
            return None

        async def delete(self, key: str) -> int:
            return 1

        async def setex(self, key: str, ttl: int, value: str) -> bool:
            return True

    with (
        patch("kubepilot.api.routes.auth.session_scope", _fake_session_scope),
        patch(
            "kubepilot.api.routes.auth.ensure_user_with_default_org",
            return_value=(user_row, MagicMock()),
        ),
        TestClient(app) as client,
    ):
        client.app.state.redis = FakeRedis()
        res = client.post("/v1/auth/session/google", json={"code": exchange_code})

    assert res.status_code == 200
    body = res.json()
    assert body["user_email"] == "user@example.com"
    assert body.get("access_token") is None

    cookie_name = settings.auth_cookie_name
    assert cookie_name in res.cookies


def test_session_verify_guest_returns_200() -> None:
    with TestClient(app) as client:
        res = client.get("/v1/auth/session/verify")
    assert res.status_code == 200
    data = res.json()
    assert data["authenticated"] is False
    assert data["idle_timeout_seconds"] == Settings().auth_session_idle_seconds


def test_session_verify_rejects_idle_session(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(auth_session_idle_seconds=60)
    monkeypatch.setattr("kubepilot.api.auth_session.get_settings", lambda: settings)
    monkeypatch.setattr("kubepilot.api.routes.auth.get_settings", lambda: settings)
    token = "idle-test-token"
    now = int(time.time())
    stale = now - 120
    session_payload = json.dumps(
        {
            "user_email": "idle@example.com",
            "display_name": "Idle",
            "created_at": now - 3600,
            "last_activity": stale,
        }
    )

    class FakeRedis:
        def __init__(self) -> None:
            self.store: dict[str, str] = {f"auth:session:{token}": session_payload}

        async def get(self, key: str) -> str | None:
            return self.store.get(key)

        async def delete(self, key: str) -> int:
            return 1 if self.store.pop(key, None) else 0

        async def setex(self, key: str, ttl: int, value: str) -> bool:
            self.store[key] = value
            return True

    redis = FakeRedis()
    with TestClient(app) as client:
        client.app.state.redis = redis
        res = client.get(
            "/v1/auth/session/verify",
            cookies={settings.auth_cookie_name: token},
        )

    assert res.status_code == 200
    assert res.json()["authenticated"] is False
    assert f"auth:session:{token}" not in redis.store
