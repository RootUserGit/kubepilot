from __future__ import annotations

from collections.abc import Generator
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from kubepilot.api.auth_session import load_session, resolve_session_token
from kubepilot.core.settings import get_settings
from kubepilot.db import models as m
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


async def require_session_user(request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Authenticated user from HttpOnly session or Bearer token, resolved to DB user + orgs."""
    token = resolve_session_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")
    redis = request.app.state.redis
    settings = get_settings()
    sess = await load_session(redis, token, settings, revoke_if_invalid=True)
    if sess is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    uid_raw = sess.get("user_id")
    email = str(sess.get("user_email", "")).strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    user_row: m.User | None = None
    if uid_raw:
        try:
            user_row = db.get(m.User, UUID(str(uid_raw)))
        except ValueError:
            user_row = None
    if user_row is None:
        user_row = db.scalars(select(m.User).where(m.User.email == email)).first()
    if user_row is None:
        raise HTTPException(
            status_code=401,
            detail="User record missing. Sign out and sign in again to refresh your account.",
        )

    org_ids = [
        str(r)
        for r in db.scalars(
            select(m.OrganizationMember.organization_id).where(m.OrganizationMember.user_id == user_row.id)
        ).all()
    ]
    display = user_row.display_name or sess.get("display_name") or user_row.email.split("@")[0]
    return {
        "user_id": str(user_row.id),
        "user_email": user_row.email,
        "display_name": display,
        "organization_ids": org_ids,
    }
