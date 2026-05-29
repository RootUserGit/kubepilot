from __future__ import annotations

import hashlib


def compute_insight_id(
    namespace: str,
    resource_kind: str,
    resource_name: str,
    check_id: str,
    container_name: str | None = None,
) -> str:
    raw = f"{namespace}:{resource_kind}:{resource_name}:{check_id}:{container_name or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
