"""Fail-fast validation before the API accepts traffic."""

from __future__ import annotations

from kubepilot.core.settings import Settings


class StartupConfigError(RuntimeError):
    """Required configuration is missing or invalid."""

    def __init__(self, message: str, *, missing: list[str] | None = None) -> None:
        super().__init__(message)
        self.missing = missing or []


def _nonempty(value: str | None) -> bool:
    return bool(value and value.strip())


def validate_api_settings(settings: Settings) -> None:
    """Raise if Google OAuth or session secret are not configured."""
    missing: list[str] = []
    if not _nonempty(settings.google_client_id):
        missing.append("KUBEPILOT_GOOGLE_CLIENT_ID")
    if not _nonempty(settings.google_client_secret):
        missing.append("KUBEPILOT_GOOGLE_CLIENT_SECRET")
    if not _nonempty(settings.auth_session_secret):
        missing.append("KUBEPILOT_AUTH_SESSION_SECRET")

    if missing:
        raise StartupConfigError(
            "KubePilot API cannot start: required Google Sign-In settings are missing. "
            f"Set in .env: {', '.join(missing)}. "
            "Generate a session secret with: openssl rand -hex 32",
            missing=missing,
        )

    secret = settings.auth_session_secret.strip()
    if len(secret) < 32:
        raise StartupConfigError(
            "KUBEPILOT_AUTH_SESSION_SECRET must be at least 32 characters.",
            missing=["KUBEPILOT_AUTH_SESSION_SECRET"],
        )
