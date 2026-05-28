from __future__ import annotations

from collections.abc import Generator
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from kubepilot.api.auth_session import load_session, resolve_session_token
from kubepilot.core.settings import get_settings
from kubepilot.db.session import get_engine, make_session_factory


def get_db() -> Generator[Session, None, None]:
    factory = make_session_factory(get_engine())
    db = factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def require_session_user(request: Request) -> dict[str, Any]:
    """Authenticated user from HttpOnly session or Bearer token."""
    token = resolve_session_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")
    redis = request.app.state.redis
    user = await load_session(redis, token, get_settings(), revoke_if_invalid=True)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
    return user
