from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from kubepilot.api.deps import get_db
from kubepilot.api.healthcheck import run_health_checks
from kubepilot.api.v1.helpers import (
    fetch_investigation_answer,
    rec_to_schema,
    run_to_schema,
    simulate_agent_connect_task,
    utc,
)
from kubepilot.core.cluster_onboarding import build_helm_install_command
from kubepilot.core.environment import is_production_environment
from kubepilot.core.namespaces_scope import resolve_scope_namespaces
from kubepilot.core.schemas import (
    AnalysisRun,
    AnalysisRunCreate,
    ClusterCreate,
    ClusterPublic,
    ClusterRegisterRequest,
    ClusterRegistrationResponse,
    ClusterRegistrationStatusResponse,
    HealthResponse,
    RecommendationList,
)
from kubepilot.core.settings import get_settings
from kubepilot.db import models as m

router = APIRouter()


@router.get("")
def api_root() -> dict[str, str]:
    settings = get_settings()
    payload: dict[str, str] = {
        "service": settings.app_name,
        "environment": settings.environment,
        "healthcheck": "/v1/healthcheck",
        "auth": "/v1/auth",
        "frontend": settings.frontend_url,
    }
    if not is_production_environment(settings.environment):
        payload["openapi_docs"] = "/v1/docs"
        payload["openapi_redoc"] = "/v1/redoc"
        payload["openapi_json"] = "/v1/openapi.json"
    return payload


@router.get("/healthcheck", response_model=HealthResponse)
async def healthcheck(request: Request, db: Session = Depends(get_db)) -> JSONResponse:
    return await run_health_checks(request, db)


@router.post("/clusters", response_model=ClusterPublic, status_code=201)
def create_cluster(body: ClusterCreate, db: Session = Depends(get_db)) -> ClusterPublic:
    settings = get_settings()
    kube = (body.kubeconfig_yaml or "").strip() or None
    if kube and not settings.allow_store_kubeconfig:
        raise HTTPException(
            status_code=403,
            detail="Kubeconfig storage is disabled (KUBEPILOT_ALLOW_STORE_KUBECONFIG=false).",
        )
    now = datetime.now(tz=UTC)
    row = m.Cluster(
        name=body.name.strip(),
        kubeconfig_yaml=kube,
        created_at=now,
        registration_status="connected" if kube else "awaiting_agent",
        onboarding_metadata=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ClusterPublic(
        id=row.id,
        name=row.name,
        created_at=row.created_at,
        kubeconfig_configured=bool(row.kubeconfig_yaml),
        registration_status=row.registration_status,
    )


@router.post("/clusters/register", response_model=ClusterRegistrationResponse, status_code=201)
def register_cluster(
    body: ClusterRegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ClusterRegistrationResponse:
    settings = get_settings()
    now = datetime.now(tz=UTC)
    helm = build_helm_install_command(
        cluster_name=body.cluster_name,
        aws_account_id=body.aws_account_id,
        aws_region=body.aws_region,
        environment=body.environment,
        role_arn=body.role_arn,
    )
    meta: dict[str, object] = {
        "aws_account_id": body.aws_account_id,
        "aws_region": body.aws_region,
        "environment": body.environment,
        "role_arn": body.role_arn,
        "helm_install_command": helm,
    }
    if body.team_owner_label:
        meta["team_owner_label"] = body.team_owner_label
    if body.namespace_scope:
        meta["namespace_scope"] = body.namespace_scope
    if body.notes:
        meta["notes"] = body.notes

    row = m.Cluster(
        name=body.cluster_name,
        kubeconfig_yaml=None,
        created_at=now,
        registration_status="awaiting_agent",
        onboarding_metadata=meta,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    sim = settings.simulate_agent_connect_seconds
    if sim is not None and sim > 0:
        background_tasks.add_task(simulate_agent_connect_task, row.id, min(sim, 3600))

    return ClusterRegistrationResponse(
        id=row.id,
        name=row.name,
        registration_status=row.registration_status,
        helm_install_command=helm,
        created_at=row.created_at,
    )


@router.get("/clusters/{cluster_id}/registration-status", response_model=ClusterRegistrationStatusResponse)
def cluster_registration_status(
    cluster_id: UUID, db: Session = Depends(get_db)
) -> ClusterRegistrationStatusResponse:
    row = db.get(m.Cluster, cluster_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Cluster not found")
    message: str | None = None
    if row.registration_status == "awaiting_agent":
        message = (
            "Install the agent with Helm from a machine with kubectl access; "
            "this page will update when the agent checks in."
        )
    elif row.registration_status == "connected":
        message = "Agent check-in detected. This cluster is linked in KubePilot."
    return ClusterRegistrationStatusResponse(
        cluster_id=row.id,
        cluster_name=row.name,
        registration_status=row.registration_status,
        message=message,
    )


@router.get("/clusters", response_model=list[ClusterPublic])
def list_clusters(db: Session = Depends(get_db)) -> list[ClusterPublic]:
    rows = db.scalars(select(m.Cluster).order_by(m.Cluster.created_at.desc())).all()
    return [
        ClusterPublic(
            id=r.id,
            name=r.name,
            created_at=r.created_at,
            kubeconfig_configured=bool(r.kubeconfig_yaml),
            registration_status=r.registration_status,
        )
        for r in rows
    ]


@router.delete("/clusters/{cluster_id}", status_code=204)
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


@router.post("/analysis-runs", response_model=AnalysisRun, status_code=201)
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
    tr_start = utc(body.time_range_start)
    tr_end = utc(body.time_range_end)

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
    return run_to_schema(run, [], investigation_answer=None)


@router.get("/analysis-runs/{analysis_run_id}", response_model=AnalysisRun)
def get_analysis_run(analysis_run_id: UUID, db: Session = Depends(get_db)) -> AnalysisRun:
    run = db.get(m.AnalysisRun, analysis_run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="not found")
    q = select(m.RecommendationORM.id).where(m.RecommendationORM.analysis_run_id == run.id)
    rec_ids = list(db.scalars(q).all())
    inv = fetch_investigation_answer(db, run.id)
    return run_to_schema(run, rec_ids, investigation_answer=inv)


@router.get("/analysis-runs/{analysis_run_id}/recommendations", response_model=RecommendationList)
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
    return RecommendationList(items=[rec_to_schema(r) for r in rows], total=total)


@router.get("/recommendations", response_model=RecommendationList)
def list_recommendations(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
) -> RecommendationList:
    total = db.scalar(select(func.count()).select_from(m.RecommendationORM)) or 0
    rows = db.scalars(
        select(m.RecommendationORM).order_by(m.RecommendationORM.created_at.desc()).offset(offset).limit(limit)
    ).all()
    return RecommendationList(items=[rec_to_schema(r) for r in rows], total=int(total))
