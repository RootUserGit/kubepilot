from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from starlette.requests import Request

from kubepilot.api.deps import get_db
from kubepilot.core.namespaces_scope import resolve_scope_namespaces
from kubepilot.core.schemas import (
    AnalysisRun,
    AnalysisRunCreate,
    AnalysisRunStatus,
    ClusterCreate,
    ClusterPublic,
    EvidenceRef,
    HealthResponse,
    Recommendation,
    RecommendationCategory,
    RecommendationList,
    RecommendationSeverity,
)
from kubepilot.core.settings import get_settings
from kubepilot.db import models as m

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _fetch_investigation_answer(db: Session, run_id: UUID) -> str | None:
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


def _run_to_schema(
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


def _rec_to_schema(row: m.RecommendationORM) -> Recommendation:
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    app.state.redis = redis
    yield
    await redis.close(True)


app = FastAPI(title=get_settings().app_name, lifespan=lifespan)


@app.get("/")
def root() -> dict[str, str]:
    """Avoid bare 404 when opening the API base URL in a browser."""
    return {
        "service": get_settings().app_name,
        "health": "/health",
        "openapi_docs": "/docs",
        "openapi_json": "/openapi.json",
        "console": "/console",
    }


@app.get("/ui")
def legacy_ui_redirect() -> RedirectResponse:
    """Old path; prefer /console."""
    return RedirectResponse(url="/console", status_code=307)


@app.get("/console", response_class=HTMLResponse)
async def console_ui(request: Request) -> HTMLResponse:
    settings = get_settings()
    return templates.TemplateResponse(
        request=request,
        name="console.html",
        context={
            "request": request,
            "allow_store_kubeconfig": settings.allow_store_kubeconfig,
        },
    )


@app.post("/v1/clusters", response_model=ClusterPublic, status_code=201)
def create_cluster(body: ClusterCreate, db: Session = Depends(get_db)) -> ClusterPublic:
    settings = get_settings()
    kube = (body.kubeconfig_yaml or "").strip() or None
    if kube and not settings.allow_store_kubeconfig:
        raise HTTPException(
            status_code=403,
            detail="Kubeconfig storage is disabled (KUBEPILOT_ALLOW_STORE_KUBECONFIG=false).",
        )
    now = datetime.now(tz=UTC)
    row = m.Cluster(name=body.name.strip(), kubeconfig_yaml=kube, created_at=now)
    db.add(row)
    db.commit()
    db.refresh(row)
    return ClusterPublic(
        id=row.id,
        name=row.name,
        created_at=row.created_at,
        kubeconfig_configured=bool(row.kubeconfig_yaml),
    )


@app.get("/v1/clusters", response_model=list[ClusterPublic])
def list_clusters(db: Session = Depends(get_db)) -> list[ClusterPublic]:
    rows = db.scalars(select(m.Cluster).order_by(m.Cluster.created_at.desc())).all()
    return [
        ClusterPublic(
            id=r.id,
            name=r.name,
            created_at=r.created_at,
            kubeconfig_configured=bool(r.kubeconfig_yaml),
        )
        for r in rows
    ]


@app.delete("/v1/clusters/{cluster_id}", status_code=204)
def delete_cluster(cluster_id: UUID, db: Session = Depends(get_db)) -> None:
    cl = db.get(m.Cluster, cluster_id)
    if cl is None:
        raise HTTPException(status_code=404, detail="not found")
    db.execute(
        update(m.AnalysisRun)
        .where(m.AnalysisRun.cluster_id == cluster_id)
        .values(cluster_id=None)
    )
    db.delete(cl)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/v1/analysis-runs", response_model=AnalysisRun, status_code=201)
async def create_analysis_run(
    body: AnalysisRunCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> AnalysisRun:
    try:
        resolved_ns = resolve_scope_namespaces(body.scope_namespace, body.scope_namespaces)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    run_id = uuid4()
    now = datetime.now(tz=UTC)
    tr_start = _utc(body.time_range_start)
    tr_end = _utc(body.time_range_end)

    scope_namespace_single: str | None = (
        resolved_ns[0] if resolved_ns is not None and len(resolved_ns) == 1 else None
    )
    scope_namespaces_json: list[str] | None = resolved_ns if resolved_ns is not None else None

    run = m.AnalysisRun(
        id=run_id,
        cluster_id=body.cluster_id,
        status="pending",
        scope_namespace=scope_namespace_single,
        scope_namespaces=scope_namespaces_json,
        scope_label_selector=body.scope_label_selector,
        time_range_start=tr_start,
        time_range_end=tr_end,
        question=body.question,
        created_at=now,
        updated_at=now,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    await request.app.state.redis.enqueue_job("run_analysis", str(run.id))
    return _run_to_schema(run, [], investigation_answer=None)


@app.get("/v1/analysis-runs/{analysis_run_id}", response_model=AnalysisRun)
def get_analysis_run(analysis_run_id: UUID, db: Session = Depends(get_db)) -> AnalysisRun:
    run = db.get(m.AnalysisRun, analysis_run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="not found")
    q = select(m.RecommendationORM.id).where(m.RecommendationORM.analysis_run_id == run.id)
    rec_ids = list(db.scalars(q).all())
    inv = _fetch_investigation_answer(db, run.id)
    return _run_to_schema(run, rec_ids, investigation_answer=inv)


@app.get("/v1/analysis-runs/{analysis_run_id}/recommendations", response_model=RecommendationList)
def list_analysis_run_recommendations(
    analysis_run_id: UUID,
    db: Session = Depends(get_db),
    limit: int = Query(default=50, le=200),
) -> RecommendationList:
    run = db.get(m.AnalysisRun, analysis_run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="not found")
    q_total = select(func.count()).select_from(m.RecommendationORM).where(
        m.RecommendationORM.analysis_run_id == analysis_run_id
    )
    total = int(db.scalar(q_total) or 0)
    rows = db.scalars(
        select(m.RecommendationORM)
        .where(m.RecommendationORM.analysis_run_id == analysis_run_id)
        .order_by(m.RecommendationORM.created_at.desc())
        .limit(limit)
    ).all()
    return RecommendationList(items=[_rec_to_schema(r) for r in rows], total=total)


@app.get("/v1/recommendations", response_model=RecommendationList)
def list_recommendations(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
) -> RecommendationList:
    total = db.scalar(select(func.count()).select_from(m.RecommendationORM)) or 0
    rows = db.scalars(
        select(m.RecommendationORM).order_by(m.RecommendationORM.created_at.desc()).offset(offset).limit(limit)
    ).all()
    return RecommendationList(items=[_rec_to_schema(r) for r in rows], total=int(total))
