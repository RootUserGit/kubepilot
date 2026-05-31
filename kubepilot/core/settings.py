from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KUBEPILOT_", env_file=".env", extra="ignore")

    app_name: str = "KubePilot"
    # development | staging | production — Swagger/ReDoc disabled when production
    environment: str = "development"
    database_url: str = Field(
        default="postgresql+psycopg://kubepilot:kubepilot@localhost:5433/kubepilot",
        description="SQLAlchemy URL (sync)",
    )
    redis_url: str = Field(default="redis://localhost:6379/0")

    # AWS / connectors (optional for local dev)
    aws_region: str | None = None
    opensearch_endpoint: str | None = None
    opensearch_use_sigv4: bool = False
    opensearch_username: str | None = None
    opensearch_password: str | None = None
    opensearch_index_prefix: str = ""

    feature_cloudwatch: bool = True
    feature_cost_explorer: bool = True
    feature_container_insights_metrics: bool = False

    llm_endpoint: str | None = None
    llm_enabled: bool = False
    # OpenAI-compatible model id (Ollama: e.g. llama3.2:3b; vLLM: match --served-model-name).
    llm_model: str = "local"

    kube_config_path: str | None = None
    analysis_job_timeout_s: int = 3600

    # When True, API accepts and persists kubeconfig YAML for registered clusters (dev/non-prod).
    # Disable in production unless paired with strong encryption and RBAC on the API.
    allow_store_kubeconfig: bool = True

    # If set (>0), background task marks new `awaiting_agent` clusters as `connected` after N seconds.
    # Production should leave unset and flip status when the real agent checks in.
    simulate_agent_connect_seconds: int | None = None

    # Comma-separated origins for the Next.js frontend (CORS).
    cors_origins: str = "http://localhost:3000"

    # Public URLs (OAuth redirects, post-login return).
    frontend_url: str = "http://localhost:3000"
    api_public_url: str = "http://localhost:8000"

    # Google Sign-In (OAuth 2.0 / OpenID Connect). Set both to enable.
    google_client_id: str | None = None
    google_client_secret: str | None = None
    # Optional override; default is {api_public_url}/v1/auth/sso/google/callback
    google_redirect_uri: str | None = None

    # Required for OAuth session state (Authlib). Use a long random string in production.
    auth_session_secret: str | None = None

    # HttpOnly session cookie (browser auth — not readable by JavaScript).
    auth_cookie_name: str = "kubepilot_session"
    # Absolute session lifetime (Redis TTL + cookie Max-Age). Default 1 day.
    auth_cookie_max_age_seconds: int = 60 * 60 * 24
    # Secure=True: cookie only sent over HTTPS (works on http://localhost in Chrome).
    auth_cookie_secure: bool = True
    auth_cookie_samesite: str = "lax"
    # When True, each /session/verify updates last_activity and Redis TTL (within max age).
    auth_session_sliding: bool = True
    # Log out if no activity for this long (enforced server-side on verify).
    auth_session_idle_seconds: int = 60 * 60 * 4

    # AWS onboarding (cross-account AssumeRole + CloudFormation quick-create).
    # KubePilot control-plane account — embedded in CloudFormation trust policy.
    aws_onboarding_account_id: str = "787943461725"
    # Optional: specific IAM role/user ARN in the KubePilot account (for docs / future tightening).
    aws_onboarding_principal_arn: str | None = None
    # Public HTTPS S3 URL to kubepilot-readonly-role.yaml (same region as stack).
    cloudformation_template_url: str | None = None

    # Fernet key for encrypting AWS profile credentials at rest (openssl rand -hex 32).
    credentials_encryption_key: str | None = None

    # In-cluster agent: POST /v1/clusters/{id}/agent/check-in with header X-KubePilot-Agent-Token.
    agent_service_token: str | None = None

    # Prefer JSON log formatting in production (configure root handlers in deployment).
    log_json: bool = False

    # Per-IP requests per minute via Redis (0 = disabled).
    rate_limit_ip_rpm: int = 0
    rate_limit_redis_prefix: str = "rl:"

    # Helm index root URL (parent of index.yaml) for the in-cluster agent chart.
    # When unset, generated install commands use --repo "${KUBEPILOT_HELM_AGENT_REPO_INDEX_URL:?...}"
    # so operators can export the URL once before pasting the command.
    helm_agent_repo_index_url: str | None = None


def get_settings() -> Settings:
    return Settings()
