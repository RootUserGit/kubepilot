"""HttpOnly session cookies backed by Redis."""

from __future__ import annotations

import json
import logging
import secrets
import time
from typing import Any

from fastapi import Request
from fastapi.responses import Response
from starlette.requests import Request as StarletteRequest

from kubepilot.core.settings import Settings, get_settings

logger = logging.getLogger(__name__)

_SESSION_PREFIX = "auth:session:"


def session_cookie_name(settings: Settings | None = None) -> str:
    return (settings or get_settings()).auth_cookie_name


def resolve_session_token(request: Request | StarletteRequest) -> str | None:
    """Cookie first (browser), then Authorization Bearer (automation / CLI)."""
    settings = get_settings()
    cookie = request.cookies.get(session_cookie_name(settings))
    if cookie and cookie.strip():
        return cookie.strip()
    auth = request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def _session_ttl_remaining(created_at: int, settings: Settings) -> int:
    """Seconds until absolute max session age from login."""
    return max(0, created_at + settings.auth_cookie_max_age_seconds - int(time.time()))


def _is_idle_expired(last_activity: int, settings: Settings) -> bool:
    if settings.auth_session_idle_seconds <= 0:
        return False
    return int(time.time()) - last_activity > settings.auth_session_idle_seconds


async def create_session(
    redis: Any,
    *,
    user_email: str,
    display_name: str | None,
    settings: Settings | None = None,
) -> str:
    s = settings or get_settings()
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    payload = {
        "user_email": user_email,
        "display_name": display_name,
        "created_at": now,
        "last_activity": now,
    }
    await redis.setex(
        f"{_SESSION_PREFIX}{token}",
        s.auth_cookie_max_age_seconds,
        json.dumps(payload),
    )
    return token


async def touch_session(redis: Any, token: str | None, settings: Settings | None = None) -> bool:
    """Record activity and refresh Redis TTL within the absolute session cap."""
    if not token:
        return False
    s = settings or get_settings()
    key = f"{_SESSION_PREFIX}{token}"
    raw = await redis.get(key)
    if raw is None:
        return False
    if isinstance(raw, bytes):
        raw = raw.decode()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return False

    now = int(time.time())
    created_at = int(data.get("created_at", now))
    ttl = _session_ttl_remaining(created_at, s)
    if ttl <= 0:
        await redis.delete(key)
        return False

    data["last_activity"] = now
    await redis.setex(key, ttl, json.dumps(data))
    return True


async def load_session(
    redis: Any,
    token: str | None,
    settings: Settings | None = None,
    *,
    revoke_if_invalid: bool = False,
) -> dict[str, str] | None:
    if not token:
        return None
    s = settings or get_settings()
    key = f"{_SESSION_PREFIX}{token}"
    raw = await redis.get(key)
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        if revoke_if_invalid:
            await redis.delete(key)
        return None

    now = int(time.time())
    created_at = int(data.get("created_at", now))
    last_activity = int(data.get("last_activity", created_at))

    invalid = False
    if _session_ttl_remaining(created_at, s) <= 0:
        invalid = True
    elif _is_idle_expired(last_activity, s):
        invalid = True

    if invalid:
        if revoke_if_invalid:
            await redis.delete(key)
        return None

    email = str(data.get("user_email", "")).strip()
    if not email:
        if revoke_if_invalid:
            await redis.delete(key)
        return None
    return {
        "user_email": email,
        "display_name": str(data.get("display_name") or email.split("@")[0]),
    }


async def revoke_session(redis: Any, token: str | None) -> None:
    if token:
        await redis.delete(f"{_SESSION_PREFIX}{token}")


def set_session_cookie(response: Response, token: str, settings: Settings | None = None) -> None:
    s = settings or get_settings()
    response.set_cookie(
        key=session_cookie_name(s),
        value=token,
        max_age=s.auth_cookie_max_age_seconds,
        httponly=True,
        secure=s.auth_cookie_secure,
        samesite=s.auth_cookie_samesite,
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings | None = None) -> None:
    s = settings or get_settings()
    response.delete_cookie(
        key=session_cookie_name(s),
        path="/",
        httponly=True,
        secure=s.auth_cookie_secure,
        samesite=s.auth_cookie_samesite,
    )
