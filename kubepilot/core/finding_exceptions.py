from __future__ import annotations

from dataclasses import dataclass, replace
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from kubepilot.core.audit_rules import AuditFinding
from kubepilot.core.schemas import RecommendationSeverity

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_CATALOG_PATH = _DATA_DIR / "trusted_workloads.yaml"

DISPOSITION_ACTIONABLE = "actionable"
DISPOSITION_ACCEPTED = "accepted_system_requirement"


@dataclass(frozen=True)
class FindingReference:
    title: str
    url: str


@dataclass(frozen=True)
class EnrichedFinding:
    """Audit finding with context-aware severity and disposition."""

    finding: AuditFinding
    raw_severity: str
    effective_severity: str
    disposition: str
    suppression_reason: str | None = None
    references: tuple[FindingReference, ...] = ()


def _load_catalog() -> list[dict[str, Any]]:
    if not _CATALOG_PATH.is_file():
        return []
    raw = yaml.safe_load(_CATALOG_PATH.read_text(encoding="utf-8")) or {}
    rules = raw.get("rules")
    return list(rules) if isinstance(rules, list) else []


@lru_cache(maxsize=1)
def trusted_workload_rules() -> tuple[dict[str, Any], ...]:
    return tuple(_load_catalog())


def _name_matches(rule: dict[str, Any], resource_name: str) -> bool:
    match_mode = rule.get("resource_name_match", "exact")
    expected = str(rule.get("resource_name", ""))
    if match_mode == "prefix":
        return resource_name.startswith(expected)
    return resource_name == expected


def _match_rule(finding: AuditFinding, rule: dict[str, Any]) -> bool:
    if str(rule.get("namespace", "")) != finding.namespace:
        return False
    if str(rule.get("resource_kind", "")) != finding.resource_kind:
        return False
    if not _name_matches(rule, finding.resource_name):
        return False
    if str(rule.get("check_id", "")) != finding.check_id:
        return False
    return True


def _parse_references(rule: dict[str, Any]) -> tuple[FindingReference, ...]:
    refs: list[FindingReference] = []
    for item in rule.get("references") or []:
        if isinstance(item, dict) and item.get("title") and item.get("url"):
            refs.append(FindingReference(title=str(item["title"]), url=str(item["url"])))
    return tuple(refs)


def apply_finding_exceptions(finding: AuditFinding) -> EnrichedFinding:
    raw = finding.severity.value
    for rule in trusted_workload_rules():
        if _match_rule(finding, rule):
            eff = str(rule.get("effective_severity", "info")).lower()
            if eff not in {s.value for s in RecommendationSeverity}:
                eff = RecommendationSeverity.info.value
            try:
                new_sev = RecommendationSeverity(eff)
            except ValueError:
                new_sev = RecommendationSeverity.info
            adjusted = replace(finding, severity=new_sev)
            return EnrichedFinding(
                finding=adjusted,
                raw_severity=raw,
                effective_severity=eff,
                disposition=str(rule.get("disposition", DISPOSITION_ACCEPTED)),
                suppression_reason=str(rule["suppression_reason"]) if rule.get("suppression_reason") else None,
                references=_parse_references(rule),
            )
    return EnrichedFinding(
        finding=finding,
        raw_severity=raw,
        effective_severity=raw,
        disposition=DISPOSITION_ACTIONABLE,
        suppression_reason=None,
        references=(),
    )


def enriched_to_insight_dict(enriched: EnrichedFinding, insight_id: str, detail: str | None) -> dict[str, Any]:
    f = enriched.finding
    refs = [{"title": r.title, "url": r.url} for r in enriched.references]
    return {
        "id": insight_id,
        "category": f.category.value,
        "severity": enriched.effective_severity,
        "raw_severity": enriched.raw_severity,
        "effective_severity": enriched.effective_severity,
        "disposition": enriched.disposition,
        "suppression_reason": enriched.suppression_reason,
        "references": refs,
        "title": f.title,
        "detail": detail,
        "resource_kind": f.resource_kind,
        "resource_name": f.resource_name,
        "namespace": f.namespace,
        "container_name": f.container_name,
        "related_pods": list(f.related_pods),
        "check_id": f.check_id,
        "remediation": f.remediation,
        "finding_type": "misconfiguration",
        "attack_techniques": [],
    }
