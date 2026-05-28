from unittest.mock import MagicMock, patch

import httpx

from kubepilot.core.settings import Settings
from kubepilot.intelligence.client import LLMClient


def test_llm_uses_configured_model_name():
    settings = Settings(
        llm_enabled=True,
        llm_endpoint="http://127.0.0.1:11434",
        llm_model="llama3.2:3b",
    )
    client = LLMClient(settings)
    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = MagicMock(
            raise_for_status=MagicMock(),
            json=MagicMock(
                return_value={"choices": [{"message": {"content": '{"summary":"ok"}'}}]}
            ),
        )
        client.complete_json_sync("system", "user")
        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["model"] == "llama3.2:3b"


def test_llm_http_error_returns_note_not_raise():
    settings = Settings(llm_enabled=True, llm_endpoint="http://127.0.0.1:8000")
    client = LLMClient(settings)
    response = MagicMock()
    response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "404",
        request=MagicMock(),
        response=response,
    )
    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = response
        out = client.complete_json_sync("system", "user payload")
    assert "note" in out
    assert "LLM request failed" in out["note"]
