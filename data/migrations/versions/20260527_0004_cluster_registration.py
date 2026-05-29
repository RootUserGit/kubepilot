"""clusters: registration status and onboarding metadata

Revision ID: 20260527_0004
Revises: 20260209_0003
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260527_0004"
down_revision = "20260209_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clusters",
        sa.Column("registration_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "clusters",
        sa.Column("onboarding_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE clusters SET registration_status = 'connected' "
            "WHERE registration_status IS NULL"
        )
    )
    op.alter_column(
        "clusters",
        "registration_status",
        nullable=False,
        server_default=sa.text("'awaiting_agent'"),
    )


def downgrade() -> None:
    op.drop_column("clusters", "onboarding_metadata")
    op.drop_column("clusters", "registration_status")
