"""initial schema

Revision ID: 20250509_0001
Revises:
Create Date: 2025-05-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20250509_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clusters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "analysis_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clusters.id"), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("scope_namespace", sa.String(length=256), nullable=True),
        sa.Column("scope_label_selector", sa.String(length=512), nullable=True),
        sa.Column("time_range_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("time_range_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("question", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("snapshot_payload", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "analysis_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("evidence_json", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "evidence_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "analysis_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("analysis_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("ref", sa.String(length=512), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("extra", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "metric_samples",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clusters.id"), nullable=True),
        sa.Column("namespace", sa.String(length=256), nullable=True),
        sa.Column("workload", sa.String(length=256), nullable=True),
        sa.Column("container", sa.String(length=256), nullable=True),
        sa.Column("cpu_millicores", sa.Float(), nullable=True),
        sa.Column("memory_mebibytes", sa.Float(), nullable=True),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "embedding_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "analysis_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("analysis_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("source_kind", sa.String(length=64), nullable=False),
        sa.Column("source_ref", sa.String(length=512), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("extra", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("embedding_chunks")
    op.drop_table("metric_samples")
    op.drop_table("evidence_chunks")
    op.drop_table("recommendations")
    op.drop_table("analysis_runs")
    op.drop_table("clusters")
