"""Test environment: required API settings before app import."""

from __future__ import annotations

import os

# Must be set before kubepilot.api.main is imported (fail-fast bootstrap).
os.environ.setdefault("KUBEPILOT_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
os.environ.setdefault("KUBEPILOT_GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault(
    "KUBEPILOT_AUTH_SESSION_SECRET",
    "test-session-secret-at-least-32-characters-long",
)
