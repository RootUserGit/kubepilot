"""Deployment environment helpers."""

from __future__ import annotations

PRODUCTION_ALIASES = frozenset({"production", "prod"})


def is_production_environment(environment: str) -> bool:
    return environment.strip().lower() in PRODUCTION_ALIASES


def fastapi_openapi_urls(environment: str) -> dict[str, str | None]:
    """Swagger UI, ReDoc, and OpenAPI JSON under /v1 — disabled in production."""
    if is_production_environment(environment):
        return {"docs_url": None, "redoc_url": None, "openapi_url": None}
    return {
        "docs_url": "/v1/docs",
        "redoc_url": "/v1/redoc",
        "openapi_url": "/v1/openapi.json",
    }
