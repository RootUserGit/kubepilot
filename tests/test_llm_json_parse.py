from kubepilot.intelligence.client.json_parse import parse_llm_json


def test_parse_plain_json():
    obj, note = parse_llm_json('{"summary":"ok","steps":[]}')
    assert obj["summary"] == "ok"
    assert note is None


def test_parse_markdown_fence_and_trailing_note():
    text = """```json
{"summary":"patch","steps":[{"order":1,"title":"Patch"}]}
```
Here is why we chose patch."""
    obj, note = parse_llm_json(text)
    assert obj["summary"] == "patch"
    assert len(obj["steps"]) == 1
    assert note and "why we chose" in note


def test_repair_truncated_json():
    truncated = (
        '{"summary":"x","steps":[{"order":1,"title":"Patch","description":"d",'
        '"command":"kubectl patch deploy nginx -n dev --type=strategic -p PATCH"}'
    )
    obj, note = parse_llm_json(truncated)
    assert obj.get("summary") == "x"
    assert len(obj.get("steps", [])) == 1


def test_parse_json_with_trailing_prose():
    text = '{"summary":"x","steps":[]} Here is an example remediation plan.'
    obj, note = parse_llm_json(text)
    assert obj["summary"] == "x"
    assert note and "example remediation" in note
