from __future__ import annotations

import re
from typing import Any

_DENIED_PATTERNS = (
    re.compile(r"kubectl\s+delete\s+.*--all", re.I),
    re.compile(r"kubectl\s+delete\s+namespace\b", re.I),
    re.compile(r"delete\s+cluster", re.I),
)


def sanitize_commands(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for step in steps:
        cmd = step.get("command")
        if isinstance(cmd, str):
            for pat in _DENIED_PATTERNS:
                if pat.search(cmd):
                    step = {**step, "command": None, "description": step.get("description", "") + " [command withheld: destructive pattern]"}
                    break
        out.append(step)
    return out
