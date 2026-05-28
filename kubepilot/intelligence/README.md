# KubePilot intelligence package

Application-layer LLM and agentic helpers. **Does not** mutate clusters.

## Boundaries

| Package | Role |
|---------|------|
| `kubepilot/core/` | Deterministic audit, exceptions, health |
| `kubepilot/intelligence/` | Explain, triage, remediation **recommendations** |
| `ai/` (repo root) | Inference server deployment (vLLM/TGI) |

## Agents

- `finding_explain` — narrative for a finding
- `finding_triage` — false-positive assessment
- `finding_remediate` — ordered steps, kubectl snippets, impact warnings

LLM output cannot change persisted severity. Use `IntelligenceService` from API routes only on user request.

## Local configuration

Set in repo root `.env` (see root `README.md` — **LLM (local dev — Ollama)**):

- `KUBEPILOT_LLM_ENABLED=true`
- `KUBEPILOT_LLM_ENDPOINT=http://127.0.0.1:11434` (base URL only; not KubePilot port 8000)
- `KUBEPILOT_LLM_MODEL=llama3.2:3b`

The client calls `{endpoint}/v1/chat/completions` and parses JSON remediation plans into structured steps for the UI.
