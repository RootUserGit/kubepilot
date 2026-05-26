# Data layer

Persistence for **metadata**, **job state**, **time-series samples**, **recommendations**, and optionally **embeddings**. OpenSearch remains the **system of record for raw logs** in Phase 1; this layer holds **derived** and **operational** data.

---

## Technology stack

| Tool | Role |
|------|------|
| **PostgreSQL 15+** | System of record for app metadata, job queues metadata, digests, recommendation rows, evidence references, and **time-series samples** (rightsizing trends). |
| **Alembic** | Schema migrations in `data/migrations/`; single source of truth with review in CI. |
| **pgvector** extension | Vector columns for RAG embeddings + hybrid filter by namespace/workload when querying similar incidents. |
| **Amazon RDS for PostgreSQL** (recommended prod) | Automated backups, Multi-AZ optional, parameter groups for `pgvector`. |
| **In-cluster PostgreSQL** (e.g. Bitnami/Ha chart) | Acceptable **non-prod only**; snapshot/restore path before prod. |
| **Amazon S3** | Large exports (ZIP/HTML/PDF reports), optional cold storage for archived API snapshots; **IRSA** role with prefix-scoped `GetObject`/`PutObject` if used. |
| **TimescaleDB** (optional extension) | If raw metric cardinality grows, hypertables for samples—**defer** until Postgres partitioning feels insufficient. |

**How we use the data stack**

- **API/worker** use SQLAlchemy models aligned with Alembic revisions; no ad-hoc DDL in application startup.
- **Retention**: partition or purge metric samples by timestamp (scheduled job) to control disk.
- **Secrets**: DB credentials via Kubernetes Secret or External Secrets; never committed.

**OpenSearch vs Postgres**

- **OpenSearch**: full-text log search at volume.
- **Postgres**: structured relational + vectors + operational **small** rows—clear separation avoids treating OpenSearch as primary OLTP.

---

## Stores

| Technology | Usage |
|----------|--------|
| **PostgreSQL** | Users/sessions (future SSO), clusters registered, analysis runs, digests, recommendation rows, evidence metadata, **metrics samples** for trends |
| **pgvector** (optional extension) | Embedding storage for RAG if not using a separate vector DB |
| **Amazon S3** (optional) | Large bundles: investigation exports, PDF/HTML reports, archived snapshots |

**RDS vs in-cluster Postgres:** Enterprise setups often use **RDS** for HA/backups; MVP may use a small in-cluster Postgres **only for non-prod** with a migration path to RDS.

---

## Schema ownership

- Migrations live under `data/migrations/` (convention) when implementation starts.
- **No Secret values** in DB; reference Kubernetes Secrets or Secrets Manager handles only.

---

## Retention

- Define TTL policy for raw metric samples (e.g. 90 days) vs aggregates (longer).
- Align log retention with OpenSearch index lifecycle policies (ILM) — operational concern shared with platform team.

---

## Backup & DR

- RDS automated backups / snapshots per org policy.
- S3 versioning optional for report artifacts.

---

## Related docs

- [docs/BLUEPRINT.md](../docs/BLUEPRINT.md)
- [services/README.md](../services/README.md)
- [ai/README.md](../ai/README.md)
