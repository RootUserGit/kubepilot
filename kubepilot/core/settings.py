from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KUBEPILOT_", env_file=".env", extra="ignore")

    app_name: str = "KubePilot"
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

    kube_config_path: str | None = None
    analysis_job_timeout_s: int = 3600

    # When True, API accepts and persists kubeconfig YAML for registered clusters (dev/non-prod).
    # Disable in production unless paired with strong encryption and RBAC on the API.
    allow_store_kubeconfig: bool = True


def get_settings() -> Settings:
    return Settings()
