from __future__ import annotations

from pydantic import BaseModel, Field


class SessionUserResponse(BaseModel):
    user_email: str
    display_name: str | None = None
    message: str | None = None


class SessionVerifyResponse(BaseModel):
    authenticated: bool
    user_email: str | None = None
    display_name: str | None = None
    session_max_age_seconds: int | None = None
    idle_timeout_seconds: int | None = None


class GoogleSessionRequest(BaseModel):
    """One-time code from the Google OAuth redirect (?code= on the login page)."""

    code: str = Field(min_length=8, max_length=256)


class SsoProvidersStatus(BaseModel):
    google: bool


class GoogleOAuthSetup(BaseModel):
    redirect_uri_in_use: str
    authorized_redirect_uris: list[str]
    authorized_javascript_origins: list[str]
    common_mistakes: list[str] = Field(
        default_factory=lambda: [
            "Using /auth/callback instead of /v1/auth/sso/google/callback",
            "Using https instead of http for local dev",
            "Trailing slash on the URI (must match exactly)",
            "Registering 127.0.0.1 but opening localhost (or the reverse)",
        ]
    )
