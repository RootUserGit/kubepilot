"""Liveness/readiness: database + Redis (unauthenticated)."""

from __future__ import annotations

import logging

from arq.connections import ArqRedis
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from kubepilot.core.schemas import HealthCheckDetail, HealthResponse

logger = logging.getLogger(__name__)


def _check_database(db: Session) -> HealthCheckDetail:
    try:
        db.execute(text("SELECT 1"))
        return HealthCheckDetail(status="ok")
    except Exception as exc:
        logger.warning("Health check: database failed: %s", exc)
        return HealthCheckDetail(status="error", detail="database unreachable")


async def _check_redis(redis: ArqRedis | None) -> HealthCheckDetail:
    if redis is None:
        return HealthCheckDetail(status="error", detail="redis pool not initialized")
    try:
        await redis.ping()
        return HealthCheckDetail(status="ok")
    except Exception as exc:
        logger.warning("Health check: redis failed: %s", exc)
        return HealthCheckDetail(status="error", detail="redis unreachable")


async def run_health_checks(request: Request, db: Session) -> JSONResponse:
    database = _check_database(db)
    redis: ArqRedis | None = getattr(request.app.state, "redis", None)
    redis_result = await _check_redis(redis)

    healthy = database.status == "ok" and redis_result.status == "ok"
    body = HealthResponse(
        status="ok" if healthy else "degraded",
        database=database,
        redis=redis_result,
    )
    status_code = 200 if healthy else 503
    return JSONResponse(status_code=status_code, content=body.model_dump())
