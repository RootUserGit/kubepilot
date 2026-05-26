"""analysis run: multiple namespaces (JSON)

Revision ID: 20260209_0003
Revises: 20250510_0002
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260209_0003"
down_revision = "20250510_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analysis_runs",
        sa.Column("scope_namespaces", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_runs", "scope_namespaces")
