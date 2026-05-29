from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from kubepilot.collectors.k8s_snapshot import collect_snapshot
from kubepilot.collectors.metrics_sampler import collect_metrics_samples
from kubepilot.connectors.cloudwatch import CloudWatchConnector
from kubepilot.connectors.cost_explorer import CostExplorerConnector
from kubepilot.connectors.opensearch import (
    OpenSearchConnector,
    indices_for_range,
    logs_sample_query_body,
)
from kubepilot.core.audit_rules import evaluate_workload_snapshot, findings_to_recommendations
from kubepilot.core.namespaces_scope import namespaces_from_analysis_run
from kubepilot.core.settings import get_settings
from kubepilot.db import models as m
from kubepilot.db.session import session_scope
from kubepilot.llm.client import LLMClient, embed_stub_sync
from kubepilot.worker.investigation_reply import (
    build_investigation_reply,
    restart_context_for_llm,
)

logger = logging.getLogger(__name__)


def run_analysis_sync(analysis_run_id: str) -> None:
    settings = get_settings()
    rid = UUID(analysis_run_id)
    with session_scope(settings) as session:
        run = session.get(m.AnalysisRun, rid)
        if run is None:
            logger.error("analysis run not found: %s", analysis_run_id)
            return
        run.status = "running"
        run.updated_at = datetime.now(tz=UTC)
        session.flush()

        cl = session.get(m.Cluster, run.cluster_id) if run.cluster_id else None
        kube_yaml = cl.kubeconfig_yaml if cl else None
        kube_path = settings.kube_config_path if not kube_yaml else None
        scoped = namespaces_from_analysis_run(run)

        try:
            try:
                snap = collect_snapshot(
                    namespaces=scoped,
                    label_selector=run.scope_label_selector or None,
                    kubeconfig_yaml=kube_yaml,
                    kube_config_path=kube_path,
                )
            except Exception as e:
                logger.warning("k8s snapshot failed: %s", e)
                snap = {"pods": [], "deployments": [], "error": str(e)}
            run.snapshot_payload = snap

            findings = evaluate_workload_snapshot(snap)
            recs = findings_to_recommendations(findings, run.id)

            for rec in recs:
                session.add(
                    m.RecommendationORM(
                        id=rec.id,
                        analysis_run_id=run.id,
                        category=rec.category.value,
                        severity=rec.severity.value,
                        title=rec.title,
                        detail=rec.detail,
                        evidence_json=[e.model_dump() for e in rec.evidence],
                        created_at=rec.created_at,
                    )
                )

            session.add(
                m.EvidenceChunk(
                    kind="k8s_snapshot",
                    ref="cluster_snapshot",
                    body=None,
                    extra={"pod_count": len(snap.get("pods", []))},
                    analysis_run_id=run.id,
                    created_at=datetime.now(tz=UTC),
                )
            )

            os_conn = OpenSearchConnector(settings)
            if settings.opensearch_endpoint:
                prefix = settings.opensearch_index_prefix
                idx_list = indices_for_range(prefix, run.time_range_start, run.time_range_end)
                session.add(
                    m.EvidenceChunk(
                        kind="opensearch_indices",
                        ref=",".join(idx_list[:8]),
                        body=None,
                        extra={"indices": idx_list},
                        analysis_run_id=run.id,
                        created_at=datetime.now(tz=UTC),
                    )
                )
                try:
                    pattern = idx_list[0] if idx_list else "*"
                    os_conn.search_sample_sync(
                        logs_sample_query_body(scoped, size=5),
                        pattern,
                    )
                except Exception as e:
                    logger.info("opensearch query skipped/failed: %s", e)

            cw = CloudWatchConnector(settings)
            try:
                cw.get_metric_data_stub(
                    "AWS/Usage",
                    "ResourceCount",
                    [{"Name": "Type", "Value": "Resource"}],
                    run.time_range_start,
                    run.time_range_end,
                )
            except Exception as e:
                logger.info("cloudwatch stub skipped: %s", e)
            session.add(
                m.EvidenceChunk(
                    kind="cloudwatch_query",
                    ref="stub_metric",
                    body=None,
                    extra={"note": "placeholder; configure real metrics per workload"},
                    analysis_run_id=run.id,
                    created_at=datetime.now(tz=UTC),
                )
            )

            ce = CostExplorerConnector(settings)
            start_d = run.time_range_start.date().isoformat()
            end_d = run.time_range_end.date().isoformat()
            try:
                ce_raw = ce.get_cost_and_usage(start_d, end_d)
            except Exception as e:
                ce_raw = {"error": str(e)}
            session.add(
                m.EvidenceChunk(
                    kind="cost_explorer",
                    ref=f"{start_d}:{end_d}",
                    body=None,
                    extra=ce_raw if isinstance(ce_raw, dict) else {"raw": str(ce_raw)},
                    analysis_run_id=run.id,
                    created_at=datetime.now(tz=UTC),
                )
            )

            metric_rows: list[dict[str, Any]] = []
            try:
                allow_metrics = set(scoped) if scoped is not None else None
                for row in collect_metrics_samples(
                    cluster_id=run.cluster_id,
                    kubeconfig_yaml=kube_yaml,
                    kube_config_path=kube_path,
                    namespace_allowlist=allow_metrics,
                ):
                    metric_rows.append(dict(row))
                    session.add(
                        m.MetricSample(
                            cluster_id=row.get("cluster_id"),
                            namespace=row.get("namespace"),
                            workload=row.get("workload"),
                            container=row.get("container"),
                            cpu_millicores=row.get("cpu_millicores"),
                            memory_mebibytes=row.get("memory_mebibytes"),
                            collected_at=row["collected_at"],
                        )
                    )
            except Exception as e:
                logger.info("metrics sampler skipped: %s", e)

            llm = LLMClient(settings)
            llm_user = (
                (run.question or "Analysis run")
                + "\n\n"
                + restart_context_for_llm(snap)
                + f"\n\nDeterministic audit findings count: {len(recs)}"
            )
            summary = llm.complete_json_sync(
                (
                    "You are an SRE assistant. Reply with JSON keys summary (string), "
                    "findings (string array). If asked about restarts, cite restart lines when "
                    "present; if causes are unknown from data, say what is missing."
                ),
                llm_user,
            )

            llm_on = bool(settings.llm_enabled and settings.llm_endpoint)
            reply_text = build_investigation_reply(
                run.question,
                snap,
                recs,
                summary,
                llm_configured=llm_on,
                metrics_samples=metric_rows,
            )

            session.add(
                m.EvidenceChunk(
                    kind="investigation_reply",
                    ref="formatted",
                    body=reply_text,
                    extra={"llm_stub": not llm_on},
                    analysis_run_id=run.id,
                    created_at=datetime.now(tz=UTC),
                )
            )

            emb = embed_stub_sync(run.question or "analysis")
            session.add(
                m.EmbeddingChunk(
                    analysis_run_id=run.id,
                    source_kind="question",
                    source_ref=str(run.id),
                    text=run.question or "",
                    embedding=emb,
                    extra={"dimensions": len(emb)},
                    created_at=datetime.now(tz=UTC),
                )
            )

            run.status = "completed"
            run.updated_at = datetime.now(tz=UTC)
        except Exception as e:
            logger.exception("analysis failed")
            run.status = "failed"
            run.error_message = str(e)
            run.updated_at = datetime.now(tz=UTC)
