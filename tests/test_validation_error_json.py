from __future__ import annotations

import json

from fastapi.exceptions import RequestValidationError


def test_request_validation_error_round_trips_through_json_default_str() -> None:
    """Mirrors validation_exception_handler: ctx may hold a ValueError (not JSON-serializable)."""
    exc = RequestValidationError(
        [
            {
                "type": "value_error",
                "loc": ("body",),
                "msg": "bad",
                "input": {},
                "ctx": {"error": ValueError("nested")},
            }
        ]
    )
    safe = json.loads(json.dumps(exc.errors(), default=str))
    json.dumps(safe)
    assert safe[0]["type"] == "value_error"
    assert "ctx" in safe[0]
