from __future__ import annotations

from fastapi.testclient import TestClient

from kubepilot.api.main import app


def test_swagger_under_v1() -> None:
    with TestClient(app) as client:
        assert client.get("/v1/docs").status_code == 200
        spec = client.get("/v1/openapi.json").json()
        assert "/v1/healthcheck" in spec["paths"]
        assert "/v1/clusters" in spec["paths"]
        assert "/v1/clusters/{cluster_id}/agent/check-in" in spec["paths"]
