from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from kubepilot.api.deps import get_db, require_session_user
from kubepilot.api.main import app
from kubepilot.db.base import Base


@pytest.fixture()
def client_with_profiles_db() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def _db() -> Generator[Session, None, None]:
        db = factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def _user() -> dict:
        return {"user_email": "tester@example.com", "display_name": "Tester"}

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[require_session_user] = _user
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_create_list_delete_aws_profile(client_with_profiles_db: TestClient) -> None:
    client = client_with_profiles_db
    create = client.post(
        "/v1/aws-profiles",
        json={
            "connection_type": "iam_role",
            "profile_name": "prod-readonly",
            "aws_account_id": "123456789012",
            "default_region": "us-east-1",
            "role_arn": "arn:aws:iam::123456789012:role/KubePilot-ReadOnly",
        },
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["profile_name"] == "prod-readonly"
    assert "secret" not in str(body).lower()

    listing = client.get("/v1/aws-profiles")
    assert listing.status_code == 200
    assert any(p["profile_name"] == "prod-readonly" for p in listing.json())

    assert client.delete(f"/v1/aws-profiles/{body['id']}").status_code == 204
