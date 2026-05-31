"""drop organization billing columns

Revision ID: 20260531_0007
Revises: 20260530_0006
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260531_0007"
down_revision = "20260530_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("organizations", "stripe_subscription_id")
    op.drop_column("organizations", "stripe_customer_id")
    op.drop_column("organizations", "billing_status")
    op.drop_column("organizations", "plan_tier")


def downgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("plan_tier", sa.String(length=32), nullable=False, server_default="free"),
    )
    op.add_column(
        "organizations",
        sa.Column("billing_status", sa.String(length=32), nullable=False, server_default="inactive"),
    )
    op.add_column("organizations", sa.Column("stripe_customer_id", sa.String(length=255), nullable=True))
    op.add_column("organizations", sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True))
