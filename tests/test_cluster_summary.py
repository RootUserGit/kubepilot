from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from kubepilot.api.deps import get_db
from kubepilot.api.main import app
from kubepilot.db import models as m
from kubepilot.db.base import Base


def test_cluster_summary_endpoint() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    cluster_id = uuid4()
    now = datetime.now(tz=UTC)

    def _db():
        db = factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    row = m.Cluster(
        id=cluster_id,
        name="minikube",
        created_at=now,
        registration_status="connected",
        kubeconfig_yaml="apiVersion: v1",
    )
    sess = factory()
    sess.add(row)
    sess.commit()
    sess.close()

    fake_summary = {
        "collected_at": now.isoformat(),
        "error": None,
        "counts": {"nodes": 1, "nodes_ready": 1, "namespaces": 4, "pods": 10, "deployments": 2},
        "nodes": [
            {
                "name": "minikube",
                "ready": True,
                "status": "Ready",
                "roles": ["control-plane"],
            }
        ],
        "insights": [
            {
                "id": "abc123",
                "category": "cost",
                "severity": "low",
                "title": "Missing resource requests/limits · Deployment/foo",
                "detail": "Container c has no CPU/memory requests or limits.",
                "resource_kind": "Deployment",
                "resource_name": "foo",
                "namespace": "default",
                "container_name": "c",
                "related_pods": ["pod-a"],
                "check_id": "missing_resources",
                "remediation": "Set requests and limits.",
            }
        ],
        "resource_counts": [{"kind": "pods", "label": "Pods", "count": 10}],
        "namespaces": ["default", "kube-system"],
        "selected_namespace": None,
        "metrics_available": False,
        "metrics_message": "Metrics Server is not available",
        "timeseries": {"cpu_millicores": [], "memory_mebibytes": []},
    }

    app.dependency_overrides[get_db] = _db
    try:
        with patch(
            "kubepilot.api.v1.router.collect_cluster_summary",
            return_value=fake_summary,
        ):
            with TestClient(app) as client:
                r = client.get(f"/v1/clusters/{cluster_id}/summary?scan=true")
        assert r.status_code == 200
        body = r.json()
        assert body["counts"]["nodes"] == 1
        assert body["nodes"][0]["name"] == "minikube"
        assert body["insights"][0]["resource_kind"] == "Deployment"
        assert body["resource_counts"][0]["kind"] == "pods"
        assert body["metrics_available"] is False
    finally:
        app.dependency_overrides.clear()


def test_cluster_summary_not_found() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def _db():
        db = factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    try:
        with TestClient(app) as client:
            r = client.get(f"/v1/clusters/{uuid4()}/summary")
        assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()
