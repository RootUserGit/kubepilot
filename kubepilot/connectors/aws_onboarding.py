from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

_ROLE_ARN_RE = re.compile(r"^arn:aws:iam::(\d{12}):role/.+$")


class AwsVerificationError(Exception):
    """AWS connectivity or permission check failed."""

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class AwsVerifySuccess:
    cluster_arn: str
    cluster_name: str
    aws_account_id: str
    aws_region: str


def parse_account_from_role_arn(role_arn: str) -> str:
    m = _ROLE_ARN_RE.match(role_arn.strip())
    if not m:
        raise AwsVerificationError(
            "Role ARN must look like arn:aws:iam::123456789012:role/your-role-name"
        )
    return m.group(1)


def _client_error_message(exc: ClientError) -> str:
    err = exc.response.get("Error", {})
    code = err.get("Code", "ClientError")
    msg = err.get("Message", str(exc))
    return f"{code}: {msg}"


def _describe_cluster(eks_client: Any, cluster_name: str) -> AwsVerifySuccess:
    try:
        resp = eks_client.describe_cluster(name=cluster_name.strip())
    except ClientError as e:
        err = e.response.get("Error", {})
        raise AwsVerificationError(
            _client_error_message(e), code=err.get("Code")
        ) from e
    except BotoCoreError as e:
        raise AwsVerificationError(str(e)) from e

    cluster = resp.get("cluster") or {}
    arn = str(cluster.get("arn") or "")
    if not arn:
        raise AwsVerificationError("describe_cluster returned no cluster ARN")

    parts = arn.split(":")
    account_id = parts[4] if len(parts) > 4 else ""
    region = parts[3] if len(parts) > 3 else ""

    return AwsVerifySuccess(
        cluster_arn=arn,
        cluster_name=str(cluster.get("name") or cluster_name),
        aws_account_id=account_id,
        aws_region=region,
    )


def verify_with_session(session: boto3.Session, *, cluster_name: str) -> AwsVerifySuccess:
    region = session.region_name
    if not region:
        raise AwsVerificationError("AWS region is required")
    eks = session.client("eks")
    result = _describe_cluster(eks, cluster_name)
    if not result.aws_account_id:
        try:
            sts = session.client("sts")
            ident = sts.get_caller_identity()
            result = AwsVerifySuccess(
                cluster_arn=result.cluster_arn,
                cluster_name=result.cluster_name,
                aws_account_id=str(ident.get("Account", "")),
                aws_region=region,
            )
        except (ClientError, BotoCoreError) as e:
            logger.debug("get_caller_identity failed after describe_cluster: %s", e)
    return result


def verify_iam_user(
    *,
    aws_region: str,
    cluster_name: str,
    aws_access_key_id: str,
    aws_secret_access_key: str,
    aws_session_token: str | None = None,
) -> AwsVerifySuccess:
    key_id = aws_access_key_id.strip()
    secret = aws_secret_access_key.strip()
    if not key_id or not secret:
        raise AwsVerificationError("AWS Access Key ID and Secret Access Key are required")

    session = boto3.Session(
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        aws_session_token=(aws_session_token or "").strip() or None,
        region_name=aws_region.strip(),
    )
    return verify_with_session(session, cluster_name=cluster_name)


def verify_iam_role(
    *,
    aws_region: str,
    cluster_name: str,
    role_arn: str,
    external_id: str,
) -> AwsVerifySuccess:
    role = role_arn.strip()
    ext = external_id.strip()
    if not role:
        raise AwsVerificationError("Role ARN is required")
    if not ext:
        raise AwsVerificationError("External ID is required")
    parse_account_from_role_arn(role)

    sts = boto3.client("sts", region_name=aws_region.strip())
    try:
        assumed = sts.assume_role(
            RoleArn=role,
            RoleSessionName="kubepilot-onboarding-verify",
            ExternalId=ext,
            DurationSeconds=900,
        )
    except ClientError as e:
        err = e.response.get("Error", {})
        raise AwsVerificationError(
            _client_error_message(e), code=err.get("Code")
        ) from e
    except BotoCoreError as e:
        raise AwsVerificationError(str(e)) from e

    creds = assumed.get("Credentials")
    if not creds:
        raise AwsVerificationError("AssumeRole succeeded but returned no credentials")

    session = boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
        region_name=aws_region.strip(),
    )
    result = verify_with_session(session, cluster_name=cluster_name)
    account = parse_account_from_role_arn(role)
    return AwsVerifySuccess(
        cluster_arn=result.cluster_arn,
        cluster_name=result.cluster_name,
        aws_account_id=account or result.aws_account_id,
        aws_region=aws_region.strip(),
    )
