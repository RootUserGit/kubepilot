from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import Field
from sqlalchemy.orm import Session

from kubepilot.api.deps import get_db, require_session_user
from kubepilot.connectors.aws_onboarding import (
    AwsVerificationError,
    verify_iam_role,
    verify_iam_user,
)
from kubepilot.connectors.aws_profile_verify import get_profile_for_user, verify_from_profile
from kubepilot.core.aws_onboarding_urls import (
    build_cloudformation_quick_create_url,
    cloudformation_template_path,
)
from kubepilot.core.schemas import (
    CloudFormationLaunchResponse,
    OnboardingExternalIdResponse,
    VerifyAwsIamRoleRequest,
    VerifyAwsIamUserRequest,
    VerifyAwsSuccessResponse,
)
from kubepilot.core.settings import get_settings

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

VerifyAwsBody = Annotated[
    VerifyAwsIamRoleRequest | VerifyAwsIamUserRequest,
    Field(discriminator="connection_type"),
]


@router.get("/external-id", response_model=OnboardingExternalIdResponse)
def create_external_id() -> OnboardingExternalIdResponse:
    """Generate a unique External ID for cross-account IAM role onboarding."""
    return OnboardingExternalIdResponse(external_id=str(uuid.uuid4()))


@router.get("/cloudformation-launch", response_model=CloudFormationLaunchResponse)
def cloudformation_launch(
    aws_region: str = Query(..., min_length=1, max_length=64),
    external_id: str | None = Query(default=None, min_length=8, max_length=128),
) -> CloudFormationLaunchResponse:
    settings = get_settings()
    ext = (external_id or "").strip() or str(uuid.uuid4())
    account_id = settings.aws_onboarding_account_id.strip()
    principal = (settings.aws_onboarding_principal_arn or "").strip() or None
    template_url = (settings.cloudformation_template_url or "").strip() or None

    quick_create: str | None = None
    setup_note: str | None = None

    if not template_url:
        setup_note = (
            "Set KUBEPILOT_CLOUDFORMATION_TEMPLATE_URL to a public HTTPS S3 URL of "
            "deploy/cloudformation/kubepilot-readonly-role.yaml in the target region. "
            "Until then, download the template from /v1/onboarding/cloudformation/template."
        )
    else:
        quick_create = build_cloudformation_quick_create_url(
            aws_region=aws_region,
            template_url=template_url,
            external_id=ext,
        )

    return CloudFormationLaunchResponse(
        external_id=ext,
        aws_region=aws_region.strip(),
        cloudformation_quick_create_url=quick_create,
        kubepilot_aws_account_id=account_id,
        kubepilot_principal_arn=principal,
        setup_note=setup_note,
    )


@router.get("/cloudformation/template")
def download_cloudformation_template() -> FileResponse:
    path = cloudformation_template_path()
    if not path.is_file():
        raise HTTPException(status_code=404, detail="CloudFormation template not found")
    return FileResponse(
        path,
        media_type="application/x-yaml",
        filename="kubepilot-readonly-role.yaml",
    )


@router.post("/verify-aws", response_model=VerifyAwsSuccessResponse)
def verify_aws(
    body: VerifyAwsBody,
    db: Session = Depends(get_db),
    user: dict = Depends(require_session_user),
) -> VerifyAwsSuccessResponse:
    """Validate AWS credentials or assumed role by calling eks:DescribeCluster."""
    try:
        if body.profile_id is not None:
            profile = get_profile_for_user(db, body.profile_id, str(user["user_email"]))
            result = verify_from_profile(
                db,
                profile=profile,
                aws_region=body.aws_region,
                cluster_name=body.cluster_name,
            )
        elif isinstance(body, VerifyAwsIamRoleRequest):
            if not body.role_arn or not body.external_id:
                raise AwsVerificationError("role_arn and external_id are required.")
            result = verify_iam_role(
                aws_region=body.aws_region,
                cluster_name=body.cluster_name,
                role_arn=body.role_arn,
                external_id=body.external_id,
            )
        else:
            if not body.aws_access_key_id or not body.aws_secret_access_key:
                raise AwsVerificationError("Access key ID and secret access key are required.")
            result = verify_iam_user(
                aws_region=body.aws_region,
                cluster_name=body.cluster_name,
                aws_access_key_id=body.aws_access_key_id,
                aws_secret_access_key=body.aws_secret_access_key,
                aws_session_token=body.aws_session_token,
            )
    except AwsVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return VerifyAwsSuccessResponse(
        cluster_arn=result.cluster_arn,
        cluster_name=result.cluster_name,
        aws_account_id=result.aws_account_id,
        aws_region=result.aws_region,
    )
