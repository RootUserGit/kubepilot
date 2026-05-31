"""Request correlation and optional Redis-backed rate limiting."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from kubepilot.core.settings import get_settings

logger = logging.getLogger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Propagate X-Request-ID (generate if missing) for log correlation."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        rid = (request.headers.get("X-Request-ID") or "").strip() or str(uuid.uuid4())
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-IP sliding window using Redis INCR (disabled when rate_limit_ip_rpm is 0)."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        settings = get_settings()
        rpm = settings.rate_limit_ip_rpm
        if rpm <= 0:
            return await call_next(request)

        client = request.client
        ip = (client.host if client else "unknown") or "unknown"
        path = request.url.path
        key = f"{settings.rate_limit_redis_prefix}{ip}:{path}"

        redis = getattr(request.app.state, "redis", None)
        if redis is None:
            return await call_next(request)

        try:
            n = await redis.incr(key)
            if n == 1:
                await redis.expire(key, 60)
            if n > rpm:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Try again shortly."},
                )
        except Exception:
            logger.warning("Rate limit check failed; allowing request", exc_info=True)

        return await call_next(request)
