# KubePilot

Read-only **decision support for Kubernetes on AWS**: cluster context, analysis runs, and a small web console. The code does not mutate your cluster or cloud accounts in Phase 1.

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

Then open [http://localhost:8000/console](http://localhost:8000/console).

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

## License

See [LICENSE](LICENSE).
