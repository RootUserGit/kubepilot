from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from kubepilot.connectors.aws_onboarding import (
    AwsVerificationError,
    AwsVerifySuccess,
    verify_iam_role,
    verify_iam_user,
)
from kubepilot.core.credentials_crypto import CredentialsCryptoError, decrypt_credentials
from kubepilot.core.settings import Settings, get_settings
from kubepilot.db import models as m


def verify_from_profile(
    db: Session,
    *,
    profile: m.AwsConnectionProfile,
    aws_region: str,
    cluster_name: str,
    settings: Settings | None = None,
) -> AwsVerifySuccess:
    s = settings or get_settings()
    region = aws_region.strip() or profile.default_region

    if profile.connection_type == "iam_role":
        if not profile.role_arn or not profile.external_id:
            raise AwsVerificationError("IAM role profile is missing role_arn or external_id.")
        return verify_iam_role(
            aws_region=region,
            cluster_name=cluster_name,
            role_arn=profile.role_arn,
            external_id=profile.external_id,
        )

    if profile.connection_type == "iam_user":
        if not profile.credentials_ciphertext:
            raise AwsVerificationError("IAM user profile has no stored credentials.")
        try:
            creds = decrypt_credentials(profile.credentials_ciphertext, s)
        except CredentialsCryptoError as e:
            raise AwsVerificationError(str(e)) from e
        return verify_iam_user(
            aws_region=region,
            cluster_name=cluster_name,
            aws_access_key_id=str(creds["aws_access_key_id"]),
            aws_secret_access_key=str(creds["aws_secret_access_key"]),
            aws_session_token=creds.get("aws_session_token"),
        )

    raise AwsVerificationError(f"Unknown connection_type: {profile.connection_type}")


def get_profile_for_user(db: Session, profile_id: UUID, user_email: str) -> m.AwsConnectionProfile:
    row = db.get(m.AwsConnectionProfile, profile_id)
    if row is None or row.user_email != user_email:
        raise AwsVerificationError("Profile not found.")
    return row
