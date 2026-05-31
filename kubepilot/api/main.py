from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

from kubepilot.api.exceptions import register_exception_handlers
from kubepilot.api.google_oauth import bootstrap_google_oauth
from kubepilot.api.middleware.saas import RateLimitMiddleware, RequestIdMiddleware
from kubepilot.api.routes.auth import router as auth_router
from kubepilot.api.v1 import v1_router
from kubepilot.core.environment import fastapi_openapi_urls, is_production_environment
from kubepilot.core.settings import Settings, get_settings
from kubepilot.core.startup import StartupConfigError, validate_api_settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    validate_api_settings(settings)
    bootstrap_google_oauth(settings)
    if is_production_environment(settings.environment):
        logger.info("OpenAPI docs disabled (KUBEPILOT_ENVIRONMENT=%s)", settings.environment)
    else:
        base = settings.api_public_url.rstrip("/")
        logger.info("OpenAPI docs: %s/v1/docs (Swagger), %s/v1/redoc", base, base)
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    app.state.redis = redis
    yield
    await redis.close(True)


def _bootstrap_or_exit() -> Settings:
    settings = get_settings()
    try:
        validate_api_settings(settings)
        bootstrap_google_oauth(settings)
    except StartupConfigError as exc:
        logger.critical("%s", exc)
        raise SystemExit(1) from exc
    return settings


_settings = _bootstrap_or_exit()
_openapi = fastapi_openapi_urls(_settings.environment)

app = FastAPI(
    title=_settings.app_name,
    description="Read-only operational intelligence for Kubernetes clusters.",
    version="0.1.0",
    lifespan=lifespan,
    **_openapi,
)
register_exception_handlers(app)

app.add_middleware(
    SessionMiddleware,
    secret_key=_settings.auth_session_secret.strip(),
    same_site="lax",
    https_only=False,
)

_cors_origins = [o.strip() for o in _settings.cors_origins.split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.add_middleware(RequestIdMiddleware)
if _settings.rate_limit_ip_rpm > 0:
    app.add_middleware(RateLimitMiddleware)

app.include_router(v1_router, prefix="/v1")
app.include_router(auth_router)


@app.get("/", include_in_schema=False)
def root_redirect() -> RedirectResponse:
    return RedirectResponse(url="/v1", status_code=307)


if not is_production_environment(_settings.environment):

    @app.get("/docs", include_in_schema=False)
    def legacy_docs_redirect() -> RedirectResponse:
        return RedirectResponse(url="/v1/docs", status_code=307)

    @app.get("/redoc", include_in_schema=False)
    def legacy_redoc_redirect() -> RedirectResponse:
        return RedirectResponse(url="/v1/redoc", status_code=307)

    @app.get("/openapi.json", include_in_schema=False)
    def legacy_openapi_redirect() -> RedirectResponse:
        return RedirectResponse(url="/v1/openapi.json", status_code=307)
