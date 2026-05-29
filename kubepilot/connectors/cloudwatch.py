from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import boto3
from botocore.config import Config as BotoConfig

from kubepilot.core.settings import Settings

logger = logging.getLogger(__name__)


class CloudWatchConnector:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        region = settings.aws_region or "us-east-1"
        self._client = boto3.client(
            "cloudwatch",
            region_name=region,
            config=BotoConfig(retries={"max_attempts": 5, "mode": "standard"}),
        )

    def get_metric_data_stub(
        self,
        namespace: str,
        metric_name: str,
        dimensions: list[dict[str, str]],
        start: datetime,
        end: datetime,
    ) -> dict[str, Any]:
        """Fetch metric datapoints (read-only)."""
        if not self._settings.feature_cloudwatch:
            return {"disabled": True}
        resp = self._client.get_metric_data(
            MetricDataQueries=[
                {
                    "Id": "m1",
                    "MetricStat": {
                        "Metric": {
                            "Namespace": namespace,
                            "MetricName": metric_name,
                            "Dimensions": dimensions,
                        },
                        "Period": 60,
                        "Stat": "Average",
                    },
                }
            ],
            StartTime=start.astimezone(UTC),
            EndTime=end.astimezone(UTC),
        )
        return {"raw": resp}
