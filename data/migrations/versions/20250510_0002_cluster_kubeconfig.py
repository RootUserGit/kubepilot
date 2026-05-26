"""cluster kubeconfig for out-of-cluster control plane

Revision ID: 20250510_0002
Revises: 20250509_0001
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20250510_0002"
down_revision = "20250509_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clusters",
        sa.Column("kubeconfig_yaml", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clusters", "kubeconfig_yaml")
