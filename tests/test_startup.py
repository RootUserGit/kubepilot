from __future__ import annotations

import pytest

from kubepilot.core.settings import Settings
from kubepilot.core.startup import StartupConfigError, validate_api_settings


def test_validate_api_settings_requires_google_and_session() -> None:
    with pytest.raises(StartupConfigError) as exc_info:
        validate_api_settings(
            Settings(
                google_client_id=None,
                google_client_secret=None,
                auth_session_secret=None,
            )
        )
    assert "KUBEPILOT_GOOGLE_CLIENT_ID" in exc_info.value.missing
    assert "KUBEPILOT_AUTH_SESSION_SECRET" in exc_info.value.missing


def test_validate_api_settings_rejects_short_session_secret() -> None:
    with pytest.raises(StartupConfigError):
        validate_api_settings(
            Settings(
                google_client_id="id.apps.googleusercontent.com",
                google_client_secret="secret",
                auth_session_secret="too-short",
            )
        )
