from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from kubepilot.core.cluster_scan_cache import (
    get_cached_summary,
    get_connectivity_status,
    persist_scan_summary,
)
from kubepilot.db import models as m


def test_persist_scan_keeps_cache_on_failure() -> None:
    cluster = m.Cluster(
        id=uuid4(),
        name="c1",
        created_at=datetime.now(tz=UTC),
        registration_status="connected",
        kubeconfig_yaml="x",
        onboarding_metadata={
            "last_summaries": {
                "__all__": {
                    "collected_at": "2026-01-01T00:00:00+00:00",
                    "error": None,
                    "insights": [{"id": "a"}],
                }
            },
            "connectivity_status": "reachable",
        },
    )
    class _Db:
        def add(self, _obj: object) -> None:
            pass

    persist_scan_summary(_Db(), cluster, None, {"error": "Cannot reach API", "collected_at": "x"})
    cached = get_cached_summary(cluster, None)
    assert cached is not None
    assert cached["insights"] == [{"id": "a"}]
    assert get_connectivity_status(cluster) == "unreachable"
