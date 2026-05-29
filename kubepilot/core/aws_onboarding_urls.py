from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

_REPO_TEMPLATE = Path(__file__).resolve().parents[2] / "deploy" / "cloudformation" / "kubepilot-readonly-role.yaml"


def cloudformation_template_path() -> Path:
    return _REPO_TEMPLATE


def build_cloudformation_quick_create_url(
    *,
    aws_region: str,
    template_url: str,
    external_id: str,
    stack_name: str = "KubePilot-ReadOnly",
) -> str:
    """AWS Console quick-create link (template must be hosted on HTTPS S3 in the target region)."""
    region = aws_region.strip()
    qs = "&".join(
        [
            f"templateURL={quote(template_url, safe='')}",
            f"stackName={quote(stack_name, safe='')}",
            f"param_ExternalId={quote(external_id, safe='')}",
        ]
    )
    return (
        f"https://{region}.console.aws.amazon.com/cloudformation/home"
        f"?region={quote(region, safe='')}"
        f"#/stacks/quickcreate?{qs}"
    )
