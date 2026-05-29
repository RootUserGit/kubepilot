from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from kubepilot.core.schemas import (
    AnalysisRun,
    AnalysisRunStatus,
    EvidenceRef,
    Recommendation,
    RecommendationCategory,
    RecommendationSeverity,
)
from kubepilot.db import models as m
from kubepilot.db.session import session_scope

logger = logging.getLogger(__name__)


def utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def fetch_investigation_answer(db: Session, run_id: UUID) -> str | None:
    row = db.scalars(
        select(m.EvidenceChunk)
        .where(
            m.EvidenceChunk.analysis_run_id == run_id,
            m.EvidenceChunk.kind == "investigation_reply",
        )
        .order_by(m.EvidenceChunk.created_at.desc())
        .limit(1)
    ).first()
    return row.body if row and row.body else None


def run_to_schema(
    run: m.AnalysisRun,
    rec_ids: list[UUID],
    *,
    investigation_answer: str | None = None,
) -> AnalysisRun:
    sns: list[str] | None = None
    if run.scope_namespaces is not None and len(run.scope_namespaces) > 0:
        sns = list(run.scope_namespaces)
    elif run.scope_namespace:
        sns = [run.scope_namespace]
    return AnalysisRun(
        id=run.id,
        cluster_id=run.cluster_id,
        status=AnalysisRunStatus(run.status),
        scope_namespace=run.scope_namespace,
        scope_namespaces=sns,
        scope_label_selector=run.scope_label_selector,
        time_range_start=run.time_range_start,
        time_range_end=run.time_range_end,
        question=run.question,
        error_message=run.error_message,
        created_at=run.created_at,
        updated_at=run.updated_at,
        recommendation_ids=rec_ids,
        investigation_answer=investigation_answer,
    )


def simulate_agent_connect_task(cluster_id: UUID, delay_s: int) -> None:
    """Dev-only: flip registration to connected after a delay (no real agent)."""
    if delay_s <= 0:
        return
    time.sleep(delay_s)
    try:
        with session_scope() as db:
            row = db.get(m.Cluster, cluster_id)
            if row is None:
                return
            if row.registration_status != "awaiting_agent":
                return
            row.registration_status = "connected"
    except Exception:
        logger.exception("simulate_agent_connect failed for %s", cluster_id)


def rec_to_schema(row: m.RecommendationORM) -> Recommendation:
    ev = []
    if row.evidence_json:
        for e in row.evidence_json:
            ev.append(EvidenceRef(**e))
    return Recommendation(
        id=row.id,
        analysis_run_id=row.analysis_run_id,
        category=RecommendationCategory(row.category),
        severity=RecommendationSeverity(row.severity),
        title=row.title,
        detail=row.detail,
        evidence=ev,
        created_at=row.created_at,
    )
