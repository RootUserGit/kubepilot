from __future__ import annotations

from kubepilot.core.environment import fastapi_openapi_urls, is_production_environment


def test_is_production_environment() -> None:
    assert is_production_environment("production")
    assert not is_production_environment("development")


def test_fastapi_openapi_urls_under_v1() -> None:
    urls = fastapi_openapi_urls("development")
    assert urls["docs_url"] == "/v1/docs"
    assert urls["redoc_url"] == "/v1/redoc"
    assert urls["openapi_url"] == "/v1/openapi.json"
    assert fastapi_openapi_urls("production")["docs_url"] is None
