"""KubePilot application package (Phase 1 read-only)."""

import sys

if sys.version_info < (3, 11):  # noqa: UP036 — runtime guard; Ruff assumes py311+
    raise RuntimeError(
        "KubePilot requires Python 3.11+. This interpreter is "
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}. "
        "Remove `.venv`, install Python 3.11+ (e.g. brew install python@3.12), then "
        "`/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv .venv` "
        "(Intel: `/usr/local/opt/python@3.12/bin/python3.12`). See README Local development."
    )

__version__ = "0.1.0"
