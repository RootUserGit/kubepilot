from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from kubepilot.api.deps import get_db
from kubepilot.api.main import app
from kubepilot.db import models as m
from kubepilot.db.base import Base


def test_list_clusters_returns_metadata() -> None:
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

    now = datetime.now(tz=UTC)
    row = m.Cluster(
        id=uuid4(),
        name="minikube-local",
        created_at=now,
        registration_status="connected",
        kubeconfig_yaml="apiVersion: v1",
        onboarding_metadata={
            "provider": "local",
            "environment": "development",
        },
    )
    sess = factory()
    sess.add(row)
    sess.commit()
    sess.close()

    app.dependency_overrides[get_db] = _db
    try:
        with TestClient(app) as client:
            r = client.get("/v1/clusters")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["name"] == "minikube-local"
        assert data[0]["provider"] == "local"
        assert data[0]["environment"] == "development"
    finally:
        app.dependency_overrides.clear()
