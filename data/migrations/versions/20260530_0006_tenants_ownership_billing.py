"""tenants ownership billing columns

Revision ID: 20260530_0006
Revises: 20260528_0005
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision = "20260530_0006"
down_revision = "20260528_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("plan_tier", sa.String(length=32), nullable=False, server_default="free"),
        sa.Column("billing_status", sa.String(length=32), nullable=False, server_default="inactive"),
        sa.Column("stripe_customer_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("max_clusters", sa.Integer(), nullable=False, server_default="5"),
    )
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "organization_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="admin"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_org_member_org_user"),
    )
    op.create_index(
        "ix_organization_members_user_id",
        "organization_members",
        ["user_id"],
    )

    op.add_column(
        "clusters",
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.add_column(
        "clusters",
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.add_column(
        "analysis_runs",
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )

    bind = op.get_bind()
    legacy_org_id = uuid.uuid4()
    legacy_user_id = uuid.uuid4()
    member_id = uuid.uuid4()

    bind.execute(
        text(
            """
            INSERT INTO organizations (id, name, plan_tier, billing_status, max_clusters)
            VALUES (:id, :name, 'free', 'inactive', 999)
            """
        ),
        {"id": legacy_org_id, "name": "Migrated (pre-tenancy)"},
    )
    bind.execute(
        text(
            """
            INSERT INTO users (id, email, display_name)
            VALUES (:id, :email, :display_name)
            """
        ),
        {
            "id": legacy_user_id,
            "email": "__legacy__@kubepilot.internal",
            "display_name": "Legacy migration user",
        },
    )
    bind.execute(
        text(
            """
            INSERT INTO organization_members (id, organization_id, user_id, role)
            VALUES (:id, :org_id, :user_id, 'admin')
            """
        ),
        {"id": member_id, "org_id": legacy_org_id, "user_id": legacy_user_id},
    )

    bind.execute(
        text(
            "UPDATE clusters SET organization_id = :org_id, owner_user_id = :user_id "
            "WHERE organization_id IS NULL"
        ),
        {"org_id": legacy_org_id, "user_id": legacy_user_id},
    )
    bind.execute(
        text(
            """
            UPDATE analysis_runs ar
            SET owner_user_id = c.owner_user_id
            FROM clusters c
            WHERE ar.cluster_id = c.id AND ar.owner_user_id IS NULL
            """
        )
    )
    bind.execute(
        text("UPDATE analysis_runs SET owner_user_id = :user_id WHERE owner_user_id IS NULL"),
        {"user_id": legacy_user_id},
    )

    op.alter_column("clusters", "organization_id", nullable=False)
    op.alter_column("clusters", "owner_user_id", nullable=False)
    op.alter_column("analysis_runs", "owner_user_id", nullable=False)


def downgrade() -> None:
    op.drop_column("analysis_runs", "owner_user_id")
    op.drop_column("clusters", "owner_user_id")
    op.drop_column("clusters", "organization_id")
    op.drop_index("ix_organization_members_user_id", table_name="organization_members")
    op.drop_table("organization_members")
    op.drop_table("users")
    op.drop_table("organizations")
