from __future__ import annotations

import logging
from typing import Any

import boto3
from botocore.config import Config as BotoConfig

from kubepilot.core.settings import Settings

logger = logging.getLogger(__name__)


class CostExplorerConnector:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        region = settings.aws_region or "us-east-1"
        self._client = boto3.client(
            "ce",
            region_name=region,
            config=BotoConfig(retries={"max_attempts": 5, "mode": "standard"}),
        )

    def get_cost_and_usage(
        self,
        start: str,
        end: str,
        granularity: str = "DAILY",
    ) -> dict[str, Any]:
        """Cost Explorer read-only; dates as YYYY-MM-DD."""
        if not self._settings.feature_cost_explorer:
            return {"disabled": True}
        resp = self._client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity=granularity,
            Metrics=["UnblendedCost"],
        )
        return {"raw": resp}
