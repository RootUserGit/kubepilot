from __future__ import annotations

import re

_AWS_KEY = re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b")
_BEARER = re.compile(r"(?i)(bearer\s+)[a-z0-9\-._~+/]+=*", re.I)
_AUTH_HEADER = re.compile(r"(?i)(authorization:\s*)([^\s]+)")
_PEM = re.compile(r"-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----")


def redact_text(text: str) -> str:
    """Mask common secret patterns before LLM or storage."""
    out = text
    out = _AWS_KEY.sub("[REDACTED_AWS_KEY]", out)
    out = _BEARER.sub(r"\1[REDACTED_TOKEN]", out)
    out = _AUTH_HEADER.sub(r"\1[REDACTED]", out)
    out = _PEM.sub("[REDACTED_PEM]", out)
    return out
