# Shared packages

Reserved for **cross-service contracts** as the codebase grows:

- OpenAPI / JSON Schema for recommendations and analysis runs
- Generated API clients
- Shared protobuf definitions (if used)

Add subfolders (`packages/api-types/`, `packages/ts-client/`) when implementation begins; avoid premature abstraction.

---

## Technology stack

| Tool | Role |
|------|------|
| **OpenAPI 3.x** | Source spec for the control-plane REST API (`packages/openapi/` when added); single artifact for FastAPI route generation or codegen. |
| **JSON Schema** | Validate `AnalysisRun`, `Recommendation`, `Evidence` payloads between worker ↔ api ↔ future UI; can embed in OpenAPI components. |
| **openapi-generator** or **datamodel-codegen** | Generate **TypeScript** client for UI and **Python** models if maintaining two languages—optional if UI is server-rendered first. |
| **Protocol Buffers** | Only if **Go** sidecars or high-performance internal RPC introduced—default is HTTP/JSON for Phase 1. |

**How we use this stack**

- Contract-first changes: update OpenAPI → regenerate clients → implement **services/api**.
- Breaking API bumps require versioned path (`/v1/`) or explicit deprecation in digest docs.

---

## Related

- [services/README.md](../services/README.md)
