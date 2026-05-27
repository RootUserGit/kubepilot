"""Google OAuth (OpenID Connect) via Authlib."""

from __future__ import annotations

import logging

from authlib.integrations.starlette_client import OAuth
from authlib.integrations.starlette_client.apps import StarletteOAuth2App

from kubepilot.core.settings import Settings, get_settings

logger = logging.getLogger(__name__)

oauth = OAuth()

_GOOGLE_OPENID_DISCOVERY = "https://accounts.google.com/.well-known/openid-configuration"
_GOOGLE_CLIENT_NAME = "google"


def google_oauth_configured(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return bool(s.google_client_id and s.google_client_secret and s.auth_session_secret)


def google_redirect_uri(settings: Settings | None = None) -> str:
    s = settings or get_settings()
    if s.google_redirect_uri and s.google_redirect_uri.strip():
        return s.google_redirect_uri.strip()
    base = s.api_public_url.rstrip("/")
    return f"{base}/v1/auth/sso/google/callback"


def google_console_redirect_uris(settings: Settings | None = None) -> list[str]:
    """URIs to paste into Google Cloud Console (localhost ↔ 127.0.0.1 are different hosts)."""
    primary = google_redirect_uri(settings)
    s = settings or get_settings()
    uris = [primary]
    if "localhost" in primary:
        uris.append(primary.replace("localhost", "127.0.0.1", 1))
    elif "127.0.0.1" in primary:
        uris.append(primary.replace("127.0.0.1", "localhost", 1))
    frontend = s.frontend_url.rstrip("/")
    if frontend not in uris:
        pass  # JS origins are separate
    return list(dict.fromkeys(uris))


def google_console_javascript_origins(settings: Settings | None = None) -> list[str]:
    s = settings or get_settings()
    origins = [s.frontend_url.rstrip("/")]
    if "localhost" in origins[0]:
        origins.append(origins[0].replace("localhost", "127.0.0.1", 1))
    elif "127.0.0.1" in origins[0]:
        origins.append(origins[0].replace("127.0.0.1", "localhost", 1))
    return list(dict.fromkeys(origins))


def log_google_console_checklist(settings: Settings) -> None:
    redirect_uris = google_console_redirect_uris(settings)
    js_origins = google_console_javascript_origins(settings)
    logger.info(
        "Google Cloud Console → OAuth client → Authorized redirect URIs (add ALL, exact match):\n  %s",
        "\n  ".join(redirect_uris),
    )
    logger.info(
        "Google Cloud Console → Authorized JavaScript origins (optional for this flow):\n  %s",
        "\n  ".join(js_origins),
    )
    logger.info("KubePilot will send redirect_uri=%s", google_redirect_uri(settings))


def google_client_registered() -> bool:
    return oauth.create_client(_GOOGLE_CLIENT_NAME) is not None


def register_google_oauth(settings: Settings | None = None, *, overwrite: bool = True) -> None:
    """Register (or refresh) the Google OAuth client. Requires validated settings."""
    s = settings or get_settings()
    client_id = (s.google_client_id or "").strip()
    client_secret = (s.google_client_secret or "").strip()
    if not client_id or not client_secret:
        raise RuntimeError("register_google_oauth called without Google credentials")

    oauth.register(
        name=_GOOGLE_CLIENT_NAME,
        client_id=client_id,
        client_secret=client_secret,
        server_metadata_url=_GOOGLE_OPENID_DISCOVERY,
        client_kwargs={"scope": "openid email profile"},
        overwrite=overwrite,
    )
    logger.info("Google OAuth client registered (redirect_uri=%s)", google_redirect_uri(s))


def get_google_oauth_client(settings: Settings | None = None) -> StarletteOAuth2App:
    """Return the Google client, registering on demand if needed."""
    s = settings or get_settings()
    client = oauth.create_client(_GOOGLE_CLIENT_NAME)
    if client is None:
        register_google_oauth(s, overwrite=True)
        client = oauth.create_client(_GOOGLE_CLIENT_NAME)
    if client is None:
        raise RuntimeError("Google OAuth client failed to register")
    return client


def bootstrap_google_oauth(settings: Settings) -> None:
    """Validate-related bootstrap: register Google client at process start."""
    register_google_oauth(settings, overwrite=True)
    log_google_console_checklist(settings)
