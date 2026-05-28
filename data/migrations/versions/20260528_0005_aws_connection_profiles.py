"""aws_connection_profiles

Revision ID: 20260528_0005
Revises: 20260527_0004
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260528_0005"
down_revision = "20260527_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "aws_connection_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_email", sa.String(length=320), nullable=False),
        sa.Column("profile_name", sa.String(length=128), nullable=False),
        sa.Column("connection_type", sa.String(length=16), nullable=False),
        sa.Column("aws_account_id", sa.String(length=12), nullable=False),
        sa.Column("default_region", sa.String(length=64), nullable=False),
        sa.Column("role_arn", sa.String(length=512), nullable=True),
        sa.Column("external_id", sa.String(length=128), nullable=True),
        sa.Column("credentials_ciphertext", sa.LargeBinary(), nullable=True),
        sa.Column("access_key_last4", sa.String(length=4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_email", "profile_name", name="uq_aws_profile_user_name"),
    )
    op.create_index(
        "ix_aws_connection_profiles_user_email",
        "aws_connection_profiles",
        ["user_email"],
    )


def downgrade() -> None:
    op.drop_index("ix_aws_connection_profiles_user_email", table_name="aws_connection_profiles")
    op.drop_table("aws_connection_profiles")
