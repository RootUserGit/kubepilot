"""User / organization bootstrap for multi-tenant SaaS."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kubepilot.db import models as m


def ensure_user_with_default_org(
    db: Session,
    *,
    email: str,
    display_name: str | None,
) -> tuple[m.User, m.Organization]:
    """Create or update the user and ensure they have a personal organization (admin)."""
    email_norm = email.strip().lower()
    now = datetime.now(tz=UTC)
    user = db.scalars(select(m.User).where(m.User.email == email_norm)).first()
    if user is None:
        user = m.User(
            id=uuid.uuid4(),
            email=email_norm,
            display_name=(display_name or "").strip() or None,
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()
    else:
        if display_name and display_name.strip() and user.display_name != display_name.strip():
            user.display_name = display_name.strip()
            user.updated_at = now

    member_rows = db.scalars(
        select(m.OrganizationMember).where(m.OrganizationMember.user_id == user.id)
    ).all()
    if member_rows:
        org = db.get(m.Organization, member_rows[0].organization_id)
        if org is not None:
            return user, org

    org_name = f"{email_norm.split('@')[0]}'s workspace"
    org = m.Organization(
        id=uuid.uuid4(),
        name=org_name[:256],
        created_at=now,
        max_clusters=5,
    )
    db.add(org)
    db.flush()
    db.add(
        m.OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org.id,
            user_id=user.id,
            role="admin",
        )
    )
    db.flush()
    return user, org


def count_clusters_for_organization(db: Session, organization_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count()).select_from(m.Cluster).where(m.Cluster.organization_id == organization_id)
        )
        or 0
    )
