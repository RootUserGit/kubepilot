"""Resolve and normalize namespace scope for analysis runs."""

from __future__ import annotations

import re
from typing import Any

_DNS_LABEL_RE = re.compile(r"^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")
_MAX_NS = 32


def normalize_namespace_names(raw: list[str]) -> list[str]:
    seen: dict[str, None] = {}
    out: list[str] = []
    for item in raw:
        s = (item or "").strip()
        if not s:
            continue
        if len(s) > 253:
            raise ValueError(f"namespace name too long: {s[:40]}...")
        if not _DNS_LABEL_RE.match(s):
            raise ValueError(f"invalid namespace name: {s!r}")
        if s not in seen:
            seen[s] = None
            out.append(s)
            if len(out) > _MAX_NS:
                raise ValueError(f"at most {_MAX_NS} namespaces per run")
    return out


def resolve_scope_namespaces(
    scope_namespace: str | None,
    scope_namespaces: list[str] | None,
) -> list[str] | None:
    """
    Return ``None`` to scan all namespaces; otherwise a non-empty deduplicated list.
    ``scope_namespaces`` wins when both are provided.
    """
    if scope_namespaces is not None and len(scope_namespaces) > 0:
        return normalize_namespace_names(list(scope_namespaces))
    if scope_namespace and scope_namespace.strip():
        return normalize_namespace_names([scope_namespace])
    return None


def namespaces_match(pod_namespace: str, allowed: list[str] | None) -> bool:
    if allowed is None:
        return True
    return pod_namespace in allowed


def namespaces_from_analysis_run(analysis_run: Any) -> list[str] | None:
    """Interpret persisted analysis run rows (supports legacy ``scope_namespace`` only)."""
    raw = getattr(analysis_run, "scope_namespaces", None)
    if raw:
        return list(raw)
    single = getattr(analysis_run, "scope_namespace", None)
    if single and str(single).strip():
        return [str(single).strip()]
    return None
