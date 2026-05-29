# KubePilot

Read-only **decision support for Kubernetes on AWS**: cluster context, analysis runs, and a Next.js dashboard. The code does not mutate your cluster or cloud accounts in Phase 1.

## What it is made of

- **`kubepilot/`** — Python app: FastAPI API, ARQ worker, database models, collectors/connectors.
- **PostgreSQL** — stores clusters, analysis runs, and related rows.
- **Redis** — job queue for the worker.
- **`Dockerfile` + `docker-compose.yml`** — run the API, worker, migrations, Postgres, and Redis together.
- **`data/migrations/`** — Alembic migrations for the database schema.
- **`packages/openapi/`** — OpenAPI description of the HTTP API.
- **`tests/`** — unit tests.

You need **Python 3.12+** on your machine if you run the API or worker outside Docker (see `pyproject.toml`).

## How to run it

**Option A — everything with Docker (simplest)**

From the repo root:

```bash
docker compose up -d --build
```

Then open the API index at [http://localhost:8000/v1](http://localhost:8000/v1) and the UI at [http://localhost:3000](http://localhost:3000) (run `make web` or `./scripts/dev.sh web` for the frontend).

**Option B — Postgres and Redis in Docker, app on your laptop**

1. Copy `env.example` to `.env` and adjust if needed (defaults match Compose: Postgres on host port **5433**).
2. Start data services:

```bash
docker compose up -d postgres redis
```

3. Install and migrate:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
python -m alembic upgrade head
```

4. Run the API (one terminal):

```bash
python -m uvicorn kubepilot.api.main:app --reload --host 0.0.0.0 --port 8000
```

5. Run the worker (another terminal, same venv and `.env`):

```bash
python -m arq kubepilot.worker.worker.WorkerSettings
```

The same flows are available as `make deps`, `make install`, `make migrate`, `make api`, and `make worker` once your venv and `.env` are set.

**Windows (no `make`)** — use the dev scripts instead:

```bash
./scripts/dev.sh install
./scripts/dev.sh deps
./scripts/dev.sh migrate
./scripts/dev.sh api    # terminal 1
./scripts/dev.sh web    # terminal 2 → http://localhost:3000
```

In CMD: `scripts\dev.bat install`, then `scripts\dev.bat deps`, etc.

## Frontend (Next.js)

Phase 1 logged-out pages live in **`frontend/`**:

- [http://localhost:3000](http://localhost:3000) — landing
- [http://localhost:3000/features](http://localhost:3000/features)
- [http://localhost:3000/onboarding](http://localhost:3000/onboarding)
- [http://localhost:3000/login](http://localhost:3000/login)

Copy `frontend/.env.local.example` → `frontend/.env.local` (API defaults to `http://localhost:8000`).

## Register a cluster (dashboard)

After sign-in, open **Clusters → Register Cluster**:

1. **Platform** — Local (kubeconfig), AWS (saved profiles or one-time keys/role), Azure/GCP coming soon.
2. **Local** — cluster name + kubeconfig YAML (recommended when API runs in Docker).
3. **AWS** — create an encrypted IAM user or IAM role profile (trust account `787943461725`), verify with `eks:DescribeCluster`, then install the read-only Helm agent.

Set `KUBEPILOT_CREDENTIALS_ENCRYPTION_KEY` in `.env` to save AWS access-key profiles (`openssl rand -hex 32`).

## Google Sign-In (local dev)

1. In [Google Cloud Console](https://console.cloud.google.com/) create an **OAuth 2.0 Client ID** (type **Web application**).
2. Set:
   - **Authorized JavaScript origins:** `http://localhost:3000` — where the Next.js app runs (used if you add browser-based Google widgets later).
   - **Authorized redirect URIs:** `http://localhost:8000/v1/auth/sso/google/callback` — where Google sends the user after login (FastAPI, not Next.js).
3. Copy **Client ID** and **Client secret** into the repo root `.env` (all **required** — the API exits on startup if any are missing):
   - `KUBEPILOT_GOOGLE_CLIENT_ID=...`
   - `KUBEPILOT_GOOGLE_CLIENT_SECRET=...`
   - `KUBEPILOT_AUTH_SESSION_SECRET=` at least 32 characters (`openssl rand -hex 32`)
4. Restart the API. If configuration is wrong, the process fails immediately with a clear log message. On the login page, use **Sign in with Google**.

Flow: Next.js → API starts OAuth → Google → API callback → short-lived code → Next.js `/login` exchanges code for a session token.

## API documentation (Swagger)

When `KUBEPILOT_ENVIRONMENT` is **not** `production` (default: `development`):

| URL | Description |
|-----|-------------|
| [http://localhost:8000/v1/docs](http://localhost:8000/v1/docs) | Swagger UI (interactive) |
| [http://localhost:8000/v1/redoc](http://localhost:8000/v1/redoc) | ReDoc |
| [http://localhost:8000/v1/openapi.json](http://localhost:8000/v1/openapi.json) | OpenAPI 3 schema |

Set `KUBEPILOT_ENVIRONMENT=production` in production deployments to disable these endpoints.

## Health checks (unauthenticated)

| Service | URL | Success |
|---------|-----|---------|
| API | `GET http://localhost:8000/v1/healthcheck` | **200** when Postgres + Redis are up; **503** if either fails |
| Frontend | `GET http://localhost:3000/healthcheck` | **200** when Next.js is running |

## Auth note

Sign-in uses **Google OAuth** and an **HttpOnly session cookie** on the API host (`credentials: "include"` from the Next.js app). Sessions expire after idle timeout or absolute max age; see `KUBEPILOT_AUTH_SESSION_IDLE_SECONDS` and `KUBEPILOT_AUTH_COOKIE_MAX_AGE_SECONDS` in `env.example`.

## LLM (local dev — Ollama)

Finding remediation and explain/triage can call a **separate** OpenAI-compatible inference server. KubePilot does **not** apply changes; it returns read-only steps and `kubectl` commands for you to run.

**1. Install Ollama and pull a model**

```bash
brew install ollama
ollama serve          # or use the Ollama app
ollama pull llama3.2:3b
```

**2. Smoke-test the inference server**

```bash
curl -s http://127.0.0.1:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:3b","messages":[{"role":"user","content":"Reply with JSON: {\"ok\": true}"}]}'
```

**3. Enable in repo root `.env`**

```bash
KUBEPILOT_LLM_ENABLED=true
KUBEPILOT_LLM_ENDPOINT=http://127.0.0.1:11434
KUBEPILOT_LLM_MODEL=llama3.2:3b
```

Do **not** set `KUBEPILOT_LLM_ENDPOINT` to the KubePilot API (`http://127.0.0.1:8000`).

**4. Restart the API**, scan a cluster, open **AI Insights** → a finding. The remediation panel shows numbered steps, impact, and copyable commands. Expand **How this was produced** for LLM notes.

Optional: `ollama cp llama3.2:3b local` if you prefer model name `local` (default in older configs).

**Production:** point `KUBEPILOT_LLM_ENDPOINT` at vLLM/TGI or a Bedrock/OpenAI proxy in your VPC (see `ai/README.md`). Set `KUBEPILOT_LLM_ENABLED=false` when you do not need AI features.

## License

See [LICENSE](LICENSE).
