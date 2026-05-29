from __future__ import annotations

from fastapi.testclient import TestClient

from kubepilot.api.main import app


def test_v1_healthcheck_returns_json_with_components() -> None:
    with TestClient(app) as client:
        response = client.get("/v1/healthcheck")
        assert response.status_code in (200, 503)
        data = response.json()
        assert data["status"] in ("ok", "degraded")
        assert "database" in data
        assert "redis" in data
        assert data["database"]["status"] in ("ok", "error")
        assert data["redis"]["status"] in ("ok", "error")


def test_legacy_health_routes_removed() -> None:
    with TestClient(app) as client:
        assert client.get("/health").status_code == 404
        assert client.get("/healthcheck").status_code == 404
