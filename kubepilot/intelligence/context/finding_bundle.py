from __future__ import annotations

import json
from typing import Any


def build_finding_context(insight: dict[str, Any], cluster_name: str) -> str:
    payload = {
        "cluster_name": cluster_name,
        "finding": {
            "id": insight.get("id"),
            "title": insight.get("title"),
            "check_id": insight.get("check_id"),
            "category": insight.get("category"),
            "severity": insight.get("severity"),
            "raw_severity": insight.get("raw_severity"),
            "effective_severity": insight.get("effective_severity"),
            "disposition": insight.get("disposition"),
            "suppression_reason": insight.get("suppression_reason"),
            "references": insight.get("references") or [],
            "namespace": insight.get("namespace"),
            "resource_kind": insight.get("resource_kind"),
            "resource_name": insight.get("resource_name"),
            "container_name": insight.get("container_name"),
            "detail": insight.get("detail"),
            "remediation": insight.get("remediation"),
            "related_pods": insight.get("related_pods") or [],
        },
    }
    return json.dumps(payload, indent=2, default=str)
