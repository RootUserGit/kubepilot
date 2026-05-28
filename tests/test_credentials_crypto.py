from __future__ import annotations

from kubepilot.core.credentials_crypto import decrypt_credentials, encrypt_credentials


def test_encrypt_decrypt_roundtrip() -> None:
    payload = {
        "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key": "secret",
        "aws_session_token": None,
    }
    blob = encrypt_credentials(payload)
    out = decrypt_credentials(blob)
    assert out["aws_access_key_id"] == payload["aws_access_key_id"]
    assert out["aws_secret_access_key"] == payload["aws_secret_access_key"]
