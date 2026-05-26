from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx

from kubepilot.core.redaction import redact_text
from kubepilot.core.settings import Settings

logger = logging.getLogger(__name__)


def logs_sample_query_body(
    namespaces: list[str] | None = None,
    *,
    size: int = 5,
) -> dict[str, Any]:
    """Sample log query; when ``namespaces`` is set, filter common Fluent Bit / ECS field names."""
    body: dict[str, Any] = {"size": size, "query": {"bool": {"must": [{"match_all": {}}]}}}
    if namespaces:
        should: list[dict[str, Any]] = []
        for field in (
            "kubernetes.namespace.keyword",
            "kubernetes.namespace",
            "k8s.namespace.name",
            "kubernetes.namespace_name",
        ):
            should.append({"terms": {field: namespaces}})
        body["query"]["bool"]["filter"] = [{"bool": {"should": should, "minimum_should_match": 1}}]
    return body


def indices_for_range(prefix: str, start: datetime, end: datetime) -> list[str]:
    from datetime import timedelta

    days: list[str] = []
    cur = start.date()
    last = end.date()
    while cur <= last:
        if prefix:
            days.append(f"{prefix}-{cur.isoformat()}".strip("-"))
        else:
            days.append(cur.isoformat())
        cur += timedelta(days=1)
    return days


class OpenSearchConnector:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._base = (settings.opensearch_endpoint or "").rstrip("/")

    def search_sample_sync(
        self,
        query_body: dict[str, Any],
        index_pattern: str,
    ) -> dict[str, Any]:
        if not self._base:
            return {"disabled": True, "reason": "no opensearch endpoint"}
        url = f"{self._base}/{quote(index_pattern, safe='*?,')}/_search"
        auth = None
        if self._settings.opensearch_username and self._settings.opensearch_password:
            auth = (
                self._settings.opensearch_username,
                self._settings.opensearch_password,
            )
        with httpx.Client(timeout=60.0) as client:
            r = client.post(url, json=query_body, auth=auth)
            r.raise_for_status()
            data = r.json()
        return self._redact_hits(data)

    def _redact_hits(self, data: dict[str, Any]) -> dict[str, Any]:
        hits = data.get("hits", {}).get("hits", [])
        for h in hits:
            src = h.get("_source")
            if isinstance(src, dict):
                for k, v in list(src.items()):
                    if isinstance(v, str):
                        src[k] = redact_text(v)
        return data
