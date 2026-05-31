from __future__ import annotations

import io
import zipfile

from kubepilot.core.agent_helm_chart_bundle import agent_helm_chart_source_dir, build_agent_chart_zip_bytes


def test_agent_chart_zip_contains_chart_yaml() -> None:
    root = agent_helm_chart_source_dir()
    assert (root / "Chart.yaml").is_file()
    data = build_agent_chart_zip_bytes()
    zf = zipfile.ZipFile(io.BytesIO(data))
    names = zf.namelist()
    assert any(n.endswith("Chart.yaml") and n.startswith("kubepilot-agent/") for n in names)
