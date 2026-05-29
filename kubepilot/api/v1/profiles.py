from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from kubepilot.api.deps import get_db, require_session_user
from kubepilot.core.credentials_crypto import CredentialsCryptoError, encrypt_credentials
from kubepilot.core.schemas import (
    AwsProfileCreateIamRole,
    AwsProfileCreateIamUser,
    AwsProfilePublic,
)
from kubepilot.core.settings import get_settings
from kubepilot.db import models as m

router = APIRouter(prefix="/aws-profiles", tags=["AWS Profiles"])

AwsProfileCreateBody = Annotated[
    AwsProfileCreateIamUser | AwsProfileCreateIamRole,
    Field(discriminator="connection_type"),
]


def _profile_to_public(row: m.AwsConnectionProfile) -> AwsProfilePublic:
    return AwsProfilePublic(
        id=row.id,
        profile_name=row.profile_name,
        connection_type=row.connection_type,
        aws_account_id=row.aws_account_id,
        default_region=row.default_region,
        role_arn=row.role_arn,
        external_id=row.external_id,
        access_key_last4=row.access_key_last4,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("", response_model=list[AwsProfilePublic])
def list_aws_profiles(
    db: Session = Depends(get_db),
    user: dict = Depends(require_session_user),
) -> list[AwsProfilePublic]:
    email = str(user["user_email"])
    rows = db.scalars(
        select(m.AwsConnectionProfile)
        .where(m.AwsConnectionProfile.user_email == email)
        .order_by(m.AwsConnectionProfile.profile_name)
    ).all()
    return [_profile_to_public(r) for r in rows]


@router.post("", response_model=AwsProfilePublic, status_code=201)
def create_aws_profile(
    body: AwsProfileCreateBody,
    db: Session = Depends(get_db),
    user: dict = Depends(require_session_user),
) -> AwsProfilePublic:
    settings = get_settings()
    now = datetime.now(tz=UTC)
    email = str(user["user_email"])

    ciphertext: bytes | None = None
    access_last4: str | None = None
    role_arn: str | None = None
    external_id: str | None = None

    if isinstance(body, AwsProfileCreateIamUser):
        key_id = body.aws_access_key_id.strip()
        secret = body.aws_secret_access_key.strip()
        try:
            ciphertext = encrypt_credentials(
                {
                    "aws_access_key_id": key_id,
                    "aws_secret_access_key": secret,
                    "aws_session_token": (body.aws_session_token or "").strip() or None,
                },
                settings,
            )
        except CredentialsCryptoError as e:
            raise HTTPException(status_code=503, detail=str(e)) from e
        access_last4 = key_id[-4:] if len(key_id) >= 4 else key_id
        role_arn = (body.role_arn or "").strip() or None
    else:
        role_arn = body.role_arn.strip()
        external_id = (body.external_id or "").strip() or str(uuid.uuid4())
        if not role_arn.startswith("arn:aws:iam::"):
            raise HTTPException(status_code=422, detail="role_arn must be a valid IAM role ARN.")

    row = m.AwsConnectionProfile(
        user_email=email,
        profile_name=body.profile_name,
        connection_type=body.connection_type,
        aws_account_id=body.aws_account_id,
        default_region=body.default_region.strip(),
        role_arn=role_arn,
        external_id=external_id,
        credentials_ciphertext=ciphertext,
        access_key_last4=access_last4,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise HTTPException(
            status_code=409,
            detail=f"Profile name '{body.profile_name}' already exists.",
        ) from e
    db.refresh(row)
    return _profile_to_public(row)


@router.get("/{profile_id}", response_model=AwsProfilePublic)
def get_aws_profile(
    profile_id: UUID,
    db: Session = Depends(get_db),
    user: dict = Depends(require_session_user),
) -> AwsProfilePublic:
    row = _get_user_profile(db, profile_id, str(user["user_email"]))
    return _profile_to_public(row)


@router.delete("/{profile_id}", status_code=204)
def delete_aws_profile(
    profile_id: UUID,
    db: Session = Depends(get_db),
    user: dict = Depends(require_session_user),
) -> None:
    row = _get_user_profile(db, profile_id, str(user["user_email"]))
    db.delete(row)


def _get_user_profile(db: Session, profile_id: UUID, user_email: str) -> m.AwsConnectionProfile:
    row = db.get(m.AwsConnectionProfile, profile_id)
    if row is None or row.user_email != user_email:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return row


def load_profile_credentials(
    db: Session, profile_id: UUID, user_email: str
) -> m.AwsConnectionProfile:
    return _get_user_profile(db, profile_id, user_email)
