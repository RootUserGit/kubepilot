from __future__ import annotations

import json
import re
from typing import Any


def parse_llm_json(text: str) -> tuple[dict[str, Any], str | None]:
    """Extract a JSON object from model output; optional trailing prose becomes a note."""
    raw = (text or "").strip()
    if not raw:
        return {}, None

    # Markdown code fence (```json ... ```)
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fenced:
        candidate = fenced.group(1).strip()
        rest = (raw[fenced.end() :] or "").strip()
    else:
        candidate = raw
        rest = None

    obj = _try_load_object(candidate)
    if obj is not None:
        if not rest and fenced:
            rest = (raw[fenced.end() :] or "").strip() or None
        return obj, rest or None

    # Brace-balanced object anywhere in the response
    start = candidate.find("{")
    if start >= 0:
        end = _matching_brace_end(candidate, start)
        if end is not None:
            chunk = candidate[start : end + 1]
            trailing = (candidate[end + 1 :] + (f" {rest}" if rest else "")).strip() or None
            obj = _try_load_object(chunk)
            if obj is not None:
                return obj, trailing

    repaired = _try_repair_truncated_object(candidate)
    if repaired is not None:
        return repaired, rest

    return {}, raw


def _try_repair_truncated_object(text: str) -> dict[str, Any] | None:
    """Close truncated JSON objects (common with small models / low token limits)."""
    chunk = text.strip()
    if not chunk.startswith("{"):
        return None
    if _try_load_object(chunk) is not None:
        return _try_load_object(chunk)
    extra_braces = chunk.count("{") - chunk.count("}")
    extra_brackets = chunk.count("[") - chunk.count("]")
    if extra_braces <= 0 and extra_brackets <= 0:
        return None
    # Close inner arrays before outer objects.
    suffix = "]" * max(0, extra_brackets) + "}" * max(0, extra_braces)
    return _try_load_object(chunk + suffix)


def _try_load_object(text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _matching_brace_end(text: str, start: int) -> int | None:
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
    return None
