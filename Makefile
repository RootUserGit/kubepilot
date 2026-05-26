# KubePilot — convenience targets. Requires Python 3.12+ venv with `pip install -e ".[dev]"`.
# Load env: `set -a && source .env && set -a` (after copying env.example → .env)

.PHONY: deps up down logs migrate api worker install

install:
	python -m pip install --upgrade pip
	python -m pip install -e ".[dev]"

deps:
	docker compose up -d postgres redis

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f api worker

migrate:
	python -m alembic upgrade head

api:
	python -m uvicorn kubepilot.api.main:app --reload --host 0.0.0.0 --port 8000

worker:
	python -m arq kubepilot.worker.worker.WorkerSettings
