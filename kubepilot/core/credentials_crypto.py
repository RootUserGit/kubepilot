from __future__ import annotations

import base64
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from kubepilot.core.settings import Settings, get_settings


class CredentialsCryptoError(RuntimeError):
    pass


def _fernet(settings: Settings | None = None) -> Fernet:
    s = settings or get_settings()
    raw = (s.credentials_encryption_key or "").strip()
    if not raw:
        raise CredentialsCryptoError(
            "KUBEPILOT_CREDENTIALS_ENCRYPTION_KEY is not configured (use openssl rand -hex 32)."
        )
    if len(raw) == 64 and all(c in "0123456789abcdef" for c in raw.lower()):
        key = base64.urlsafe_b64encode(bytes.fromhex(raw))
    else:
        key = raw.encode() if isinstance(raw, str) else raw
    try:
        return Fernet(key)
    except Exception as e:
        raise CredentialsCryptoError("Invalid KUBEPILOT_CREDENTIALS_ENCRYPTION_KEY format.") from e


def encrypt_credentials(payload: dict[str, Any], settings: Settings | None = None) -> bytes:
    data = json.dumps(payload, separators=(",", ":")).encode()
    return _fernet(settings).encrypt(data)


def decrypt_credentials(blob: bytes, settings: Settings | None = None) -> dict[str, Any]:
    try:
        raw = _fernet(settings).decrypt(blob)
    except InvalidToken as e:
        raise CredentialsCryptoError("Could not decrypt stored credentials.") from e
    return json.loads(raw.decode())
