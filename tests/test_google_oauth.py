from __future__ import annotations

from kubepilot.api.google_oauth import (
    bootstrap_google_oauth,
    google_client_registered,
    google_console_redirect_uris,
    google_redirect_uri,
)
from kubepilot.core.settings import Settings


def test_google_redirect_uri_uses_api_public_url() -> None:
    s = Settings(
        api_public_url="http://localhost:8000",
        google_client_id="x.apps.googleusercontent.com",
        google_client_secret="y",
        auth_session_secret="a" * 32,
    )
    assert google_redirect_uri(s) == "http://localhost:8000/v1/auth/sso/google/callback"


def test_console_redirect_uris_includes_localhost_and_127() -> None:
    s = Settings(
        api_public_url="http://localhost:8000",
        google_client_id="x",
        google_client_secret="y",
        auth_session_secret="a" * 32,
    )
    uris = google_console_redirect_uris(s)
    assert "http://localhost:8000/v1/auth/sso/google/callback" in uris
    assert "http://127.0.0.1:8000/v1/auth/sso/google/callback" in uris


def test_bootstrap_registers_google_client() -> None:
    s = Settings(
        google_client_id="test-id.apps.googleusercontent.com",
        google_client_secret="test-secret",
        auth_session_secret="x" * 32,
    )
    bootstrap_google_oauth(s)
    assert google_client_registered()
