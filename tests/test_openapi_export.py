from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def test_export_openapi_script_writes_json(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    out = tmp_path / "openapi.generated.json"
    env = os.environ.copy()
    env["KUBEPILOT_OPENAPI_EXPORT_PATH"] = str(out)
    r = subprocess.run(
        [sys.executable, str(root / "scripts" / "export_openapi.py")],
        cwd=str(root),
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    assert r.returncode == 0, r.stderr + r.stdout
    text = out.read_text(encoding="utf-8")
    assert "/v1/healthcheck" in text
    assert "/v1/clusters/{cluster_id}/agent/check-in" in text
