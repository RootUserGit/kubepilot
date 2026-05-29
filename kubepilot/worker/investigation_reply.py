"""Format the human-readable investigation reply shown in the API and dashboard."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from typing import Any

from kubepilot.core.schemas import Recommendation


def _gather_restarts(snapshot: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    for pod in snapshot.get("pods") or []:
        ns = pod.get("namespace")
        pn = pod.get("name")
        for c in pod.get("containers") or []:
            rc = int(c.get("restart_count") or 0)
            if rc <= 0:
                continue
            reason = c.get("last_termination_reason")
            exit_code = c.get("last_exit_code")
            extra = ""
            if reason or exit_code is not None:
                extra = f" — last exit: {reason or 'unknown'} (code {exit_code})"
            lines.append(f"{ns}/{pn} / {c.get('name')}: {rc} restart(s){extra}")
    return sorted(lines)


def restart_context_for_llm(snapshot: dict[str, Any]) -> str:
    lines = _gather_restarts(snapshot)
    if not lines:
        return "No containers with restart_count > 0 in this snapshot."
    return "Containers with restarts:\n" + "\n".join(lines)


def _restart_plain_language(restart_lines: list[str]) -> list[str]:
    """Short, user-facing interpretation (not medical/legal advice — infra hints)."""
    out: list[str] = []
    if not restart_lines:
        out.append(
            "No containers in this snapshot still show a non‑zero restart count. "
            "If pods restarted earlier and are healthy now, Kubernetes may have reset "
            "the counter context."
        )
        return out

    out.append(
        f"We found {len(restart_lines)} container line(s) with restart_count > 0 "
        "at collection time."
    )
    control_plane = sum(
        1
        for line in restart_lines
        if re.search(
            r"kube-(controller-manager|scheduler|apiserver|etcd)|control-plane",
            line,
            re.I,
        )
    )
    if control_plane:
        out.append(
            "Some entries look like control plane or node components (often in kube-system). "
            "A small restart count (e.g. 1) on kind/minikube clusters is common during startup "
            "or node rotation — not necessarily an application bug."
        )

    oom = [ln for ln in restart_lines if "OOMKilled" in ln or "Memory" in (ln or "")]
    if oom:
        out.append(
            "At least one line mentions termination tied to memory — worth checking "
            "container memory limits and actual usage (see utilization section below "
            "if metrics are available)."
        )

    out.append(
        "Exact historical reasons (every crash loop, eviction, image pull) live in Pod events "
        "and logs — use `kubectl describe pod <name> -n <ns>` or ship logs to OpenSearch and "
        "set KUBEPILOT_OPENSEARCH_ENDPOINT for deeper checks."
    )
    return out


def format_namespace_utilization(samples: list[dict[str, Any]]) -> str:
    """Aggregate metrics-server style samples by namespace and by pod."""
    if not samples:
        return (
            "No live CPU/memory samples were returned. Usually that means **metrics-server** is "
            "not installed or the metrics API is unreachable from this kubeconfig. "
            "Install metrics-server (or your distro’s equivalent), wait until `kubectl top pods` "
            "works, then run this analysis again."
        )

    ns_cpu: dict[str, float] = defaultdict(float)
    ns_mem: dict[str, float] = defaultdict(float)
    pod_totals: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])

    for s in samples:
        ns = (s.get("namespace") or "?").strip()
        wl = (s.get("workload") or "?").strip()
        cpu = float(s.get("cpu_millicores") or 0)
        mem = float(s.get("memory_mebibytes") or 0)
        ns_cpu[ns] += cpu
        ns_mem[ns] += mem
        key = (ns, wl)
        pod_totals[key][0] += cpu
        pod_totals[key][1] += mem

    lines: list[str] = []
    lines.append(
        "Figures below are **current** usage from the Kubernetes Metrics API (same source as "
        "`kubectl top pods`), taken at snapshot time — not a historical average."
    )
    lines.append("")
    lines.append("Totals by namespace (sum of containers reporting metrics):")
    for ns in sorted(ns_cpu.keys()):
        cpu = ns_cpu[ns]
        mem = ns_mem[ns]
        cpu_s = f"{cpu:.0f}m" if cpu < 10000 else f"{cpu / 1000:.2f} cores"
        lines.append(f"  • {ns}: CPU ~{cpu_s}, memory ~{mem:.1f} MiB")
    lines.append("")
    lines.append("By pod (each line is that pod’s containers summed):")
    sorted_pods = sorted(pod_totals.items(), key=lambda x: (-x[1][0], x[0][0], x[0][1]))
    for (ns, wl), (cpu, mem) in sorted_pods[:80]:
        cpu_s = f"{cpu:.0f}m" if cpu < 10000 else f"{cpu / 1000:.2f} cores"
        lines.append(f"  • {ns}/{wl}: CPU ~{cpu_s}, memory ~{mem:.1f} MiB")
    if len(sorted_pods) > 80:
        lines.append(f"  … and {len(sorted_pods) - 80} more pods (truncated).")
    return "\n".join(lines)


def build_investigation_reply(
    question: str | None,
    snapshot: dict[str, Any],
    recommendations: list[Recommendation],
    llm_json: dict[str, Any],
    *,
    llm_configured: bool,
    metrics_samples: list[dict[str, Any]] | None = None,
) -> str:
    """Build plain-text reply: restarts, utilization, audit, optional LLM."""
    metrics_samples = metrics_samples or []
    sections: list[str] = []

    if question and question.strip():
        sections.append("### Your question")
        sections.append(question.strip())
        sections.append("")

    sections.append("### Pod restarts (what we know from the API)")
    restarts = _gather_restarts(snapshot)
    if restarts:
        sections.append("These workloads reported at least one container restart at snapshot time:")
        for line in restarts:
            sections.append(f"  • {line}")
        sections.append("")
        sections.extend(_restart_plain_language(restarts))
    else:
        sections.append(
            "No containers in scope still show restart_count > 0. "
            "Earlier crashes may have recovered before this snapshot."
        )
    sections.append("")

    sections.append("### CPU and memory utilization")
    sections.append(format_namespace_utilization(metrics_samples))
    sections.append("")

    sections.append("### Configuration checks (automated audit)")
    titles = [r.title for r in recommendations[:20]]
    if titles:
        sections.append(
            "These are rule-based hints from the workload snapshot (not from your question text):"
        )
        for t in titles:
            sections.append(f"  • {t}")
    else:
        sections.append("No extra configuration warnings were produced for this scope.")
    sections.append("")

    sections.append("### Assistant narrative")
    if llm_configured and llm_json.get("summary"):
        sections.append(str(llm_json["summary"]).strip())
        if llm_json.get("findings"):
            sections.append("")
            sections.append("Additional detail:")
            sections.append(json.dumps(llm_json["findings"], default=str, indent=2)[:4000])
    else:
        sections.append(
            "An LLM is **not** connected, so there is no separate essay-style answer. "
            "Everything useful for this run is in the sections above "
            "(restarts, utilization, audit)."
        )
        sections.append("")
        sections.append(
            "To enable a written summary: set `KUBEPILOT_LLM_ENABLED=true` and "
            "`KUBEPILOT_LLM_ENDPOINT` to the **base URL** of an OpenAI-compatible server "
            "(the app calls `/v1/chat/completions`). Restart the **worker** after changing `.env`."
        )

    return "\n".join(sections).strip()
