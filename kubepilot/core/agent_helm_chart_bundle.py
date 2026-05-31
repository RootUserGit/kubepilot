"""Zip bundle of the embedded kubepilot-agent Helm chart (offline install)."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path


def agent_helm_chart_source_dir() -> Path:
    """Directory containing Chart.yaml for the kubepilot-agent chart (repo: charts/kubepilot-agent)."""
    # kubepilot/core/agent_helm_chart_bundle.py → parents[2] = repository root
    return Path(__file__).resolve().parents[2] / "charts" / "kubepilot-agent"


def build_agent_chart_zip_bytes() -> bytes:
    """Return a zip whose root folder is ``kubepilot-agent/`` (suitable for unzip then ``helm install ./kubepilot-agent``)."""
    root = agent_helm_chart_source_dir()
    if not (root / "Chart.yaml").is_file():
        raise FileNotFoundError(f"Missing Helm chart under {root}")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(root.rglob("*")):
            if path.is_file():
                arcname = "kubepilot-agent/" + path.relative_to(root).as_posix()
                zf.write(path, arcname)
    return buf.getvalue()
