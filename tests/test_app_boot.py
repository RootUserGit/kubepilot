"""Smoke tests: dependencies and FastAPI app load."""

from __future__ import annotations


def test_oauth_dependencies_importable() -> None:
    import authlib  # noqa: F401
    import itsdangerous  # noqa: F401


def test_fastapi_app_imports() -> None:
    from kubepilot.api.main import app

    assert app.title
