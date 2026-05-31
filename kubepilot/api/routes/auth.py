from __future__ import annotations

import json
import logging
import secrets

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

from kubepilot.api.auth_session import (
    clear_session_cookie,
    create_session,
    load_session,
    resolve_session_token,
    revoke_session,
    set_session_cookie,
    touch_session,
)
from kubepilot.api.google_oauth import (
    get_google_oauth_client,
    google_client_registered,
    google_console_javascript_origins,
    google_console_redirect_uris,
    google_redirect_uri,
)
from kubepilot.api.routes.auth_schemas import (
    GoogleOAuthSetup,
    GoogleSessionRequest,
    SessionUserResponse,
    SessionVerifyResponse,
    SsoProvidersStatus,
)
from kubepilot.core.settings import Settings, get_settings
from kubepilot.db.session import session_scope
from kubepilot.db.tenancy import ensure_user_with_default_org

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/auth", tags=["auth"])

_SSO_EXCHANGE_PREFIX = "auth:sso:exchange:"
_SSO_EXCHANGE_TTL_SECONDS = 120


def _frontend_login_url(*, query: str = "") -> str:
    base = get_settings().frontend_url.rstrip("/")
    return f"{base}/login{query}"


async def _issue_session_response(
    request: Request,
    *,
    user_email: str,
    display_name: str | None,
    message: str,
    user_id: str | None = None,
) -> JSONResponse:
    settings = get_settings()
    redis = request.app.state.redis
    token = await create_session(
        redis,
        user_email=user_email,
        display_name=display_name,
        user_id=user_id,
        settings=settings,
    )
    body = SessionUserResponse(
        user_email=user_email,
        display_name=display_name,
        message=message,
    )
    response = JSONResponse(content=body.model_dump())
    set_session_cookie(response, token, settings)
    return response


def _sso_error_redirect(reason: str) -> RedirectResponse:
    from urllib.parse import quote

    return RedirectResponse(url=_frontend_login_url(query=f"?sso_error={quote(reason)}"))


def _session_policy_fields(settings: Settings) -> dict[str, int]:
    return {
        "session_max_age_seconds": settings.auth_cookie_max_age_seconds,
        "idle_timeout_seconds": settings.auth_session_idle_seconds,
    }


@router.get("/sso/google/setup", response_model=GoogleOAuthSetup)
def google_oauth_setup() -> GoogleOAuthSetup:
    """Return the exact redirect URI(s) to register in Google Cloud Console."""
    settings = get_settings()
    return GoogleOAuthSetup(
        redirect_uri_in_use=google_redirect_uri(settings),
        authorized_redirect_uris=google_console_redirect_uris(settings),
        authorized_javascript_origins=google_console_javascript_origins(settings),
    )


@router.get("/sso/providers", response_model=SsoProvidersStatus)
def sso_providers() -> SsoProvidersStatus:
    return SsoProvidersStatus(google=google_client_registered())


@router.get("/sso/google")
async def google_sso_login(request: Request) -> RedirectResponse:
    if not google_client_registered():
        raise HTTPException(
            status_code=503,
            detail="Google OAuth client is not ready. Restart the API after setting .env.",
        )
    client = get_google_oauth_client()
    redirect_uri = google_redirect_uri()
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/sso/google/callback")
async def google_sso_callback(request: Request) -> RedirectResponse:
    if not google_client_registered():
        return _sso_error_redirect("not_configured")

    client = get_google_oauth_client()
    try:
        token = await client.authorize_access_token(request)
    except Exception:
        logger.exception("Google OAuth token exchange failed")
        return _sso_error_redirect("token_exchange_failed")

    user_info = token.get("userinfo")
    if not user_info:
        return _sso_error_redirect("missing_profile")

    email = str(user_info.get("email", "")).strip()
    if not email:
        return _sso_error_redirect("missing_email")

    if user_info.get("email_verified") is False:
        return _sso_error_redirect("email_not_verified")

    display = (
        str(user_info.get("name") or "").strip()
        or str(user_info.get("given_name") or "").strip()
        or email.split("@")[0]
    )
    exchange_code = secrets.token_urlsafe(32)

    redis = request.app.state.redis
    await redis.setex(
        f"{_SSO_EXCHANGE_PREFIX}{exchange_code}",
        _SSO_EXCHANGE_TTL_SECONDS,
        json.dumps({"user_email": email, "display_name": display}),
    )

    logger.info("Google SSO success for %s", email)
    return RedirectResponse(url=_frontend_login_url(query=f"?code={exchange_code}"))


@router.get("/session/verify", response_model=SessionVerifyResponse)
async def session_verify(request: Request) -> SessionVerifyResponse:
    settings = get_settings()
    policy = _session_policy_fields(settings)
    token = resolve_session_token(request)
    redis = request.app.state.redis
    user = await load_session(redis, token, settings, revoke_if_invalid=True)
    if user is None:
        return SessionVerifyResponse(authenticated=False, **policy)
    if settings.auth_session_sliding:
        await touch_session(redis, token, settings)
    return SessionVerifyResponse(
        authenticated=True,
        user_email=user["user_email"],
        display_name=user.get("display_name"),
        **policy,
    )


@router.post("/logout")
async def auth_logout(request: Request) -> JSONResponse:
    settings = get_settings()
    token = resolve_session_token(request)
    await revoke_session(request.app.state.redis, token)
    response = JSONResponse(content={"message": "Signed out"})
    clear_session_cookie(response, settings)
    return response


@router.post("/session/google", response_model=SessionUserResponse)
async def session_google(body: GoogleSessionRequest, request: Request) -> JSONResponse:
    redis = request.app.state.redis
    raw = await redis.get(f"{_SSO_EXCHANGE_PREFIX}{body.code}")
    if raw is None:
        raise HTTPException(status_code=400, detail="Invalid or expired sign-in code. Try again.")

    if isinstance(raw, bytes):
        raw = raw.decode()

    await redis.delete(f"{_SSO_EXCHANGE_PREFIX}{body.code}")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail="corrupt exchange payload") from e

    with session_scope() as db:
        user_row, _org = ensure_user_with_default_org(
            db,
            email=str(data["user_email"]),
            display_name=data.get("display_name"),
        )
        email_out = user_row.email
        display_out = user_row.display_name or data.get("display_name")
        user_id_str = str(user_row.id)

    return await _issue_session_response(
        request,
        user_email=email_out,
        display_name=display_out,
        message="Signed in with Google. Welcome to KubePilot.",
        user_id=user_id_str,
    )
