from kubepilot.core.redaction import redact_text


def test_redacts_bearer():
    s = 'Authorization: Bearer abc.def.ghi'
    assert "REDACTED" in redact_text(s)


def test_redacts_aws_key_prefix():
    s = "AKIAIOSFODNN7EXAMPLE"
    assert "REDACTED" in redact_text(s)
