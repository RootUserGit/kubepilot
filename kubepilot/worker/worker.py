from __future__ import annotations

import asyncio
import logging
import os

from arq.connections import RedisSettings

from kubepilot.worker.pipeline import run_analysis_sync

logger = logging.getLogger(__name__)


async def run_analysis(ctx, analysis_run_id: str) -> None:
    await asyncio.to_thread(run_analysis_sync, analysis_run_id)


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(
        os.environ.get("KUBEPILOT_REDIS_URL", "redis://127.0.0.1:6379/0")
    )
    functions = [run_analysis]
