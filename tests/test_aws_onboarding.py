from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from kubepilot.api.deps import require_session_user
from kubepilot.api.main import app
from kubepilot.connectors.aws_onboarding import (
    AwsVerificationError,
    parse_account_from_role_arn,
    verify_iam_role,
    verify_iam_user,
)
from kubepilot.core.aws_onboarding_urls import build_cloudformation_quick_create_url


def test_parse_account_from_role_arn() -> None:
    assert parse_account_from_role_arn("arn:aws:iam::123456789012:role/KubePilot-ReadOnly") == "123456789012"


def test_build_cloudformation_quick_create_url() -> None:
    url = build_cloudformation_quick_create_url(
        aws_region="us-east-1",
        template_url="https://example.s3.us-east-1.amazonaws.com/template.yaml",
        external_id="ext-123",
    )
    assert "us-east-1.console.aws.amazon.com" in url
    assert "param_ExternalId=ext-123" in url
    assert "KubePilotPrincipalArn" not in url
    assert "quickcreate" in url


@patch("kubepilot.connectors.aws_onboarding.boto3")
def test_verify_iam_role_success(mock_boto3: MagicMock) -> None:
    sts = MagicMock()
    mock_boto3.client.return_value = sts
    sts.assume_role.return_value = {
        "Credentials": {
            "AccessKeyId": "A",
            "SecretAccessKey": "B",
            "SessionToken": "C",
        }
    }

    session = MagicMock()
    mock_boto3.Session.return_value = session
    eks = MagicMock()
    session.client.return_value = eks
    eks.describe_cluster.return_value = {
        "cluster": {
            "name": "prod-core",
            "arn": "arn:aws:eks:us-east-1:123456789012:cluster/prod-core",
        }
    }

    result = verify_iam_role(
        aws_region="us-east-1",
        cluster_name="prod-core",
        role_arn="arn:aws:iam::123456789012:role/KubePilot-ReadOnly",
        external_id="550e8400-e29b-41d4-a716-446655440000",
    )
    assert result.cluster_name == "prod-core"
    assert result.aws_account_id == "123456789012"
    sts.assume_role.assert_called_once()


@patch("kubepilot.connectors.aws_onboarding.boto3")
def test_verify_iam_user_access_denied(mock_boto3: MagicMock) -> None:
    from botocore.exceptions import ClientError

    session = MagicMock()
    mock_boto3.Session.return_value = session
    eks = MagicMock()
    session.client.return_value = eks
    eks.describe_cluster.side_effect = ClientError(
        {"Error": {"Code": "AccessDeniedException", "Message": "not authorized"}},
        "DescribeCluster",
    )

    with pytest.raises(AwsVerificationError, match="AccessDeniedException"):
        verify_iam_user(
            aws_region="us-west-2",
            cluster_name="dev-cluster",
            aws_access_key_id="AKIAIOSFODNN7EXAMPLE",
            aws_secret_access_key="secret",
        )


async def _mock_user() -> dict:
    return {"user_email": "test@example.com", "display_name": "Test"}


def test_verify_aws_endpoint_iam_role() -> None:
    app.dependency_overrides[require_session_user] = _mock_user
    patcher = patch("kubepilot.api.v1.onboarding.verify_iam_role")
    with patcher as mock_verify, TestClient(app) as client:
        from kubepilot.connectors.aws_onboarding import AwsVerifySuccess

        mock_verify.return_value = AwsVerifySuccess(
            cluster_arn="arn:aws:eks:us-east-1:123456789012:cluster/prod",
            cluster_name="prod",
            aws_account_id="123456789012",
            aws_region="us-east-1",
        )
        r = client.post(
            "/v1/onboarding/verify-aws",
            json={
                "connection_type": "iam_role",
                "aws_region": "us-east-1",
                "cluster_name": "prod",
                "role_arn": "arn:aws:iam::123456789012:role/KubePilot-ReadOnly",
                "external_id": "550e8400-e29b-41d4-a716-446655440000",
            },
        )
    assert r.status_code == 200
    assert r.json()["status"] == "success"
    assert r.json()["aws_account_id"] == "123456789012"
    app.dependency_overrides.clear()


def test_verify_aws_endpoint_returns_400_on_failure() -> None:
    app.dependency_overrides[require_session_user] = _mock_user
    patcher = patch("kubepilot.api.v1.onboarding.verify_iam_user")
    with patcher as mock_verify, TestClient(app) as client:
        mock_verify.side_effect = AwsVerificationError("AccessDenied: denied")
        r = client.post(
            "/v1/onboarding/verify-aws",
            json={
                "connection_type": "iam_user",
                "aws_region": "us-west-2",
                "cluster_name": "dev",
                "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
                "aws_secret_access_key": "secret",
            },
        )
    assert r.status_code == 400
    assert "AccessDenied" in r.json()["detail"]
    app.dependency_overrides.clear()


def test_external_id_endpoint() -> None:
    with TestClient(app) as client:
        r = client.get("/v1/onboarding/external-id")
        assert r.status_code == 200
        assert len(r.json()["external_id"]) >= 32
